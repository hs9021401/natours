const multer = require('multer');
const sharp = require('sharp');
const Tour = require('./../models/tourModel');
const APIFeatures = require('./../utils/apiFeatures');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        // To accept the file pass `true`, like so:
        cb(null, true);
    } else {
        // To reject this file pass `false`, like so:
        cb(new AppError('Not a image. Please upload only images', 400), false);
    }
};

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter
});

exports.uploadTourImages = upload.fields([
    { name: 'imageCover', maxCount: 1 },
    { name: 'images', maxCount: 3 }
]);

exports.resizeTourImages = catchAsync(async (req, res, next) => {
    if (!req.files.imageCover || !req.files.images) return next();

    // 1) Cover images
    //將檔名存到req.body.imageCover
    req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
    await sharp(req.files.imageCover[0].buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${req.body.imageCover}`);

    //2) Images
    req.body.images = [];
    await Promise.all(
        req.files.images.map(async (file, i) => {
            const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

            await sharp(file.buffer)
                .resize(2000, 1333)
                .toFormat('jpeg')
                .jpeg({ quality: 90 })
                .toFile(`public/img/tours/${filename}`);

            req.body.images.push(filename);
        })
    );

    next();
});

exports.aliasTopTours = (req, res, next) => {
    //Prefilling parts of the query object before we then reach the getAllTour handler.
    req.query.limit = '5';
    req.query.sort = '-ratingsAverage,price';
    req.query.fields = 'name,price,raingsAverage,summary,difficulty';
    next();
};

exports.getAllTour = factory.getAll(Tour);
// exports.getAllTour = catchAsync(async (req, res, next) => {
//     console.log(req.requestTime, req.query);
//     // EXECUTE QUERY
//     const features = new APIFeatures(Tour.find(), req.query) //放入Query物件, 和從express進來的query string (JSON物件)
//         .filter()
//         .sort()
//         .limitFields()
//         .paginate();
//     const tours = await features.query;

//     // SEND RESPONSE
//     res.status(200).json({
//         status: 'success',
//         result: tours.length,
//         data: tours
//     });
// });

exports.getTour = factory.getOne(Tour, { path: 'reviews' });
// exports.getTour = catchAsync(async (req, res, next) => {
//     //populate的作用是將reference的資料(定義在tourSchema裡的guides)fill up with 實際的值, 但是在getAllTour也會需要用到, 所以我們會加在tourModel裡的Query Middleware

//     const tour = await Tour.findById(req.params.id).populate('reviews'); //將virtual populate列出來

//     if (!tour) {
//         return next(new AppError('No tour found with that ID!', 404));
//     }

//     res.status(200).json({
//         status: 'success',
//         data: { tour }
//     });
// });

exports.createTour = factory.createOne(Tour);
// exports.createTour =catchAsync(async (req, res, next) => {
//     const newTour = await Tour.create(req.body);

//     res.status(201).json({
//         status: 'success',
//         data: {
//             tour: newTour
//         }
//     });
// });

exports.updateTour = factory.updateOne(Tour);

exports.deleteTour = factory.deleteOne(Tour); //使用通用函數
// exports.deleteTour = catchAsync(async (req, res, next) => {
//     const tour = await Tour.findByIdAndDelete(req.params.id);

//     if (!tour) {
//         return next(new AppError('No tour found with that ID!', 404));
//     }
//     res.status(204).json({
//         status: 'success',
//         data: null
//     });
// });

//統計: 蒐集那些ratingsAverage大於等於4.5的資料, 再將全部的資料成為按照難度組成不同group, 各個group再計算平均值, 及最大最小值
exports.getTourStats = catchAsync(async (req, res, next) => {
    const stats = await Tour.aggregate([
        //match , 挑出首要分組的條件
        {
            $match: { ratingsAverage: { $gte: 4.5 } }
        },
        //group stage
        {
            $group: {
                // _id: null ,  //如果不依照某類別分類而只要算總體的統計, 將此欄位設為null即可
                // _id: '$difficulty' ,
                _id: { $toUpper: '$difficulty' }, //要使用group則_id為必要的輸出欄位, 我們指定difficulty做為分類 ,$toUpper,內建operator, 轉大寫
                numTours: { $sum: 1 }, //利用$sum: 1 算出每一類別,總共有幾筆資料
                numRatings: { $sum: '$ratingsQuantity' },
                avgRating: { $avg: '$ratingsAverage' }, //$avg, 內建operator, 算平均值
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
            }
        },
        {
            $sort: { avgPrice: 1 } //set to 1 遞增
        }
        // ,
        // {
        //     //可再次使用match, 針對上一動所得到的Docuemnt, 濾掉EASY
        //     $match: { _id: { $ne: 'EASY' } }
        // }
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            stats: stats
        }
    });
});

//要統計該年每個月分的旅遊數量
exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
    const year = req.params.year * 1;

    const plan = await Tour.aggregate([
        {
            /*一個tour可能6月7月8月都有出團如下:
                {
                    "name": "TourA",
                    "startDates": [
                    "2021-06-19T02:00:00.000Z",
                    "2021-07-20T02:00:00.000Z",
                    "2021-08-18T02:00:00.000Z"]                
                }
                 
                使用 $unwind 可以將array裡的資料拆出來展開變這樣
                
                {
                    "name": "TourA",
                    "startDates": "2021-06-19T02:00:00.000Z"         
                },
                {
                    "name": "TourA",
                    "startDates": "2021-07-20T02:00:00.000Z",            
                },
                {
                    "name": "TourA",
                    "startDates": "2021-08-18T02:00:00.000Z"               
                }
                */

            $unwind: '$startDates' //使用單引號框起來並用$標示的是document裡的欄位
        },
        {
            $match: {
                startDates: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) }
            }
        },
        {
            $group: {
                _id: { $month: '$startDates' }, //MongoDB 的 $month運算子, 可取出月份
                numTourStarts: { $sum: 1 },
                tours: { $push: '$name' } //將tour名稱push到array
            }
        },
        {
            $addFields: { month: '$_id' } //建立一個month欄位, 並且把_id的值放進去, 用以取代_id欄位
        },
        {
            $project: { _id: 0 } //將_id欄位給隱藏起來
        },
        {
            $sort: { numTourStarts: -1 }
        },
        {
            $limit: 12
        }
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            plan
        }
    });
});

// router.route('/tours-within/:distance/center/:latlng/unit/:unit', tourController.getToursWithin);
// /tours-within/233/center/34.207568, -118.334172/unit/mi

exports.getToursWithin = catchAsync(async (req, res, next) => {
    //Destruct req.params
    const { distance, latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');

    //換算球面幾何距離
    //https://www.docs4dev.com/docs/zh/mongodb/v3.6/reference/tutorial-calculate-distances-using-spherical-geometry-with-2d-geospatial-indexes.html
    const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

    if (!lat || !lng) {
        next(new AppError('Please provide latitude and longitude in the format lat,lng', 400));
    }

    console.log(distance, lat, lng, unit);

    const tours = await Tour.find({ startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } } });

    res.status(200).json({
        status: 'success',
        result: tours.length,
        data: { data: tours }
    });
});

exports.getDistances = catchAsync(async (req, res, next) => {
    const { latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');

    const multiplier = unit === 'mi' ? 0.000621371192 : 0.001; //1 meter to mile = 0.000621371192

    if (!lat || !lng) {
        next(new AppError('Please provide latitude and longitude in the format lat,lng', 400));
    }

    //geospatial 第一個aggreagation pipeline
    //https://docs.mongodb.com/manual/reference/operator/aggregation/geoNear/
    const distances = await Tour.aggregate([
        {
            //Outputs documents in order of nearest to farthest from a specified point. Kilometers
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lng * 1, lat * 1]
                },
                distanceField: 'distance',
                distanceMultiplier: multiplier
            }
        },
        {
            $project: {
                distance: 1,
                name: 1
            }
        }
    ]);

    res.status(200).json({
        status: 'success',
        data: { data: distances }
    });
});
