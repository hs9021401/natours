const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');

const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

const Email = require('./../utils/email');

//在Jason Web Token裡面第一個參數是payload(要被encode的資料)放的是user的id
//第二個加密的密鑰
//token過期時間
const signToken = id => {
    return jwt.sign({ id: id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

const createSendToken = (user, statusCode, req, res) => {
    const token = signToken(user._id);

    //設定token為cookie發送給client端
    res.cookie('jwt', token, {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000), //用來設定持續性 Cookie 的到期日。
        httpOnly: true, // 確保只透過 HTTP(S) 傳送 Cookie，而不透過用戶端 JavaScript 傳送，如此有助於防範跨網站 Scripting 攻擊。
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
    });

    //Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user: user
        }
    });
};

exports.signup = catchAsync(async (req, res, next) => {
    const newUser = await User.create(req.body);

    const url = `${req.protocol}://${req.get('host')}/me`;
    // console.log(url);
    await new Email(newUser, url).sendWelcome();

    // const newUser = await User.create({
    //     name: req.body.name,
    //     email: req.body.email,
    //     password: req.body.password,
    //     passwordConfirm: req.body.passwordConfirm,
    //     passwordChangedAt: req.body.passwordChangedAt,
    //     role: req.body.role
    // });

    //回傳jwt token給client
    createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    //1) Check if the email and password exist
    if (!email || !password) {
        return next(new AppError('Please provide email and password', '400'));
    }
    //2) Check if the user exist and password is correct
    //在userModel我們預設把password設定為select時不會回傳, 而在下面我們需要使用到password, 所以需要另外select出來
    const user = await User.findOne({ email: email }).select('+password');
    // const correct = await user.correctPassword(password, user.password); //把這段放到下面的判斷式的原因, 是因為如果上面user不存在的話,就不應該走到這一段而是直接return掉

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    //3)  If everything OK, send token to client
    createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
    //logout就是給client端一個無效的token
    res.cookie('jwt', 'loggout~~', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({
        status: 'success'
    });
};

exports.protect = catchAsync(async (req, res, next) => {
    //1) Getting token and check of it's there
    //通常client會將token塞到http header裡面, 呈現方式如下
    //Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVlNGQ0MDI5ZTRkZmZlMzEyODYwNDIyMyIsImlhdCI6MTU4MjIwNTk1NSwiZXhwIjoxNTg5OTgxOTU1fQ.mve0X1zdFxShl-HVjh-8w0LHahPQ22IJ8_m-LH_KP9Y
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        //如果req.headers.authorization沒有jwt, 我們可以試著從app.js所使用的cookie-parser middle所獲取的req.cookies.jwt裡面找
        token = req.cookies.jwt;
    }

    if (!token) return next(new AppError('You are not logged in! Please log in to get access.', 401));

    //2) Verify the token, 此verify函式是async func轉換成可以回傳promise
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET); //promisify(jwt.verify) 會回傳promise
    //後面的(token, process.env.JWT_SECRET), 會直接呼叫
    //decoded 的資料會回傳類似以下 { id: '5e3c2613a530d03934e55ca8', iat: 1581256256, exp: 1589032256 }

    //3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) return next(new AppError('The user belonging to this token does no longer exist.', 401));

    //4) Check if user changed password after the token was issued  (iat: issued at)
    if (currentUser.changedPasswordAfter(decoded.iat) === true) {
        return next(new AppError('User recently change password! Please log in again!', 401));
    }

    //Grant access to protected route
    //最重要的部分~ 經過重重關卡,　提升權限!!!
    req.user = currentUser;

    //There is a logged user (Pug template可以直接存取 'res.locals' 裡所有的參數, 固定寫法) 在pug裡就可以直接使用 user.XXX 取得資料
    res.locals.user = currentUser;

    next();
});

//Only for rendered pages, no errors! For Pug use!!
//用來得到登入狀態改變UI右上角的狀態
exports.isLoggedIn = async (req, res, next) => {
    //1) Getting token and check of it's there

    //req.cookies 是 cookieParser middleware所產生帶來的
    if (req.cookies.jwt) {
        try {
            //1) Verify the token
            const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);

            //2) Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) return next();

            //3) Check if user changed password after the token was issued  (iat: issued at)
            if (currentUser.changedPasswordAfter(decoded.iat) === true) {
                return next();
            }

            //There is a logged user (Pug template可以直接存取 'res.locals' 裡所有的參數, 固定寫法)
            res.locals.user = currentUser;

            return next();
        } catch (err) {
            return next();
        }
    }
    next();
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        //roles is an array like ['admin', 'lead-guide']
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
    //1) Get user based on Posted Email
    const user = await User.findOne({ email: req.body.email });
    if (!user) return next(new AppError('There is no user with that email address.', '404'));

    //2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    // console.log('Reset Token=', resetToken);
    await user.save({ validateBeforeSave: false });

    //3) Send it to user's Email
    try {
        const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
        await new Email(user, resetURL).sendPasswordReset();

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(new AppError('There was an error sending the email. Try again later!'), 500);
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    //1) Get user based on token
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });

    //2)If token has not expired, and there is user, set the new password
    if (!user) return next(new AppError('Token is invalid or has expired'), 400);

    //3) Update changePasswordAt property for the  user
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    //4) Log the user in, send JWT
    createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
    //1) Get user from collection
    const user = await User.findById(req.user.id).select('+password');

    //2) Check if POSTed current password is correct
    if (!user || !(await user.correctPassword(req.body.passwordCurrent, user.password))) {
        return next(new AppError('Your current password is wrong', 401));
    }

    //3) If so, update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    //4) Log use in, send JWT
    createSendToken(user, 200, req, res);
});
