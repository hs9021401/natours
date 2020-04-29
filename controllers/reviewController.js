// const catchAsync = require('./../utils/catchAsync');
const Review = require('./../models/reviewModel');
const factory = require('./handlerFactory');

exports.getAllReviews = factory.getAll(Review);
// exports.getAllReviews = catchAsync(async (req, res, next) => {

//     const reviews = await Review.find(filter);
//     res.status(200).json({
//         status: 'success',
//         results: reviews.length,
//         data: { reviews }
//     });
// });

//建立middleware設置tour和user的ID
exports.setTourUserIds = (req, res, next) => {
    if (!req.body.tour) req.body.tour = req.params.tourId;
    if (!req.body.user) req.body.user = req.user.id;
    next();
};

exports.createReview = factory.createOne(Review);
// exports.createReview = catchAsync(async (req, res, next) => {
// if (!req.body.tour) req.body.tour = req.params.tourId;
// if (!req.body.user) req.body.user = req.user.id;
//     //Allow nested routes
//     //兩種建立review的方法
//     //-- {{URL}}api/v1/tours/TOUR的ID/reviews  //使用.use轉到reviewRouter搭配mergeParam可將tour的ID合併到req.param物件裡, 將rating, review放在body後post
//     //-- {{URL}}api/v1/reviews  將review,rating,tour,user放在body後post

//     const newReview = await Review.create(req.body);
//     res.status(201).json({
//         status: 'success',
//         data: {
//             review: newReview
//         }
//     });
// });

exports.updateReview = factory.updateOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.getReview = factory.getOne(Review);
