const multer = require('multer');
const sharp = require('sharp');
const User = require('./../models/userModel');
const AppError = require('./../utils/appError');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handlerFactory');

//multer 檔案上傳
//使用參考https://github.com/expressjs/multer
// const multerStorage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'public/img/users'); //第一個參數是error, 如果沒有則寫null
//     },
//     filename: (req, file, cb) => {
//         //user-id232345-timestamp.jpeg
//         const ext = file.mimetype.split('/')[1];
//         console.log('EXT: ', ext);
//         cb(null, `user-${req.user.id}-${Date.now()}.${ext}`); //第二個參數放 檔名+副檔名
//     }
// });

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

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
    if (!req.file) return next();

    req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

    await sharp(req.file.buffer)
        .resize(500, 500)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/users/${req.file.filename}`);

    next();
});

const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if (allowedFields.includes(el)) {
            newObj[el] = obj[el];
        }
    });
    return newObj;
};

exports.getAllUsers = factory.getAll(User);
// exports.getAllUsers = catchAsync(async (req, res, next) => {
//     const users = await User.find();

//     // SEND RESPONSE
//     res.status(200).json({
//         status: 'success',
//         result: users.length,
//         data: users
//     });
// });

//因為我們user id不是放在URL裡面, 所以使用req.param.id無法取得user ID, 但是我們可以使用這個middleware,
//自己將已登入的user id從req.user物件取出並手動加入
exports.getMe = (req, res, next) => {
    req.params.id = req.user.id;
    next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
    //console.log(req.file);

    //1) Create error if user POSTs passwrod data
    if (req.body.password || req.body.passwordConfirm)
        next(new AppError('This route is not for password update. Please use /updateMyPassword'), 400);

    //3) Filtered our unwanted fields names that are not allowed to be updated
    const filteredBody = filterObj(req.body, 'name', 'email');

    if (req.file) filteredBody.photo = req.file.filename;

    //2) Update user document
    const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, { new: true, runValidators: true }); //new: bool - true to return the modified document rather than the original. defaults to false

    res.status(200).json({
        status: 'success',
        data: {
            user: updatedUser
        }
    });
});

//使用者刪除帳號, 僅是將active設為false, 實際在database裡並未被刪除, 只是不啟用
exports.deleteMe = catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user.id, { active: false });

    res.status(204).json({
        status: 'success',
        data: null
    });
});

//其實這個沒用, 因為我們已經有signup 功能了
exports.createUser = (req, res) => {
    res.status(500).json({
        status: 'error',
        message: 'This route is not defined! Please use /signup instead.'
    });
};

exports.getUser = factory.getOne(User);
// exports.getUser = (req, res) => {
//     res.status(500).json({
//         status: 'error',
//         message: 'This route is not yet defined!'
//     });
// };

//Do not update password with this!
exports.updateUser = factory.updateOne(User);
// exports.updateUser = (req, res) => {
//     res.status(500).json({
//         status: 'error',
//         message: 'This route is not yet defined!'
//     });
// };

exports.deleteUser = factory.deleteOne(User);
// exports.deleteUser = (req, res) => {
//     res.status(500).json({
//         status: 'error',
//         message: 'This route is not yet defined!'
//     });
// };
