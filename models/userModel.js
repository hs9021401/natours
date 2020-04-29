const crypto = require('crypto');
const mongoose = require('mongoose');
const validator_lib = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please tell use your name!']
    },
    email: {
        type: String,
        required: [true, 'Please provide your email!'],
        unique: true,
        lowercase: true,
        validate: [validator_lib.isEmail, 'Please provode a valid email']
    },
    photo: {
        type: String,
        default: 'default.jpg'
    },
    role: {
        type: String,
        enum: ['user', 'guide', 'lead-guide', 'admin'],
        default: 'user'
    },
    password: {
        type: String,
        required: [true, 'Please input a password'],
        minlength: 8,
        select: false //讓密碼不要在select時回傳給client
    },
    passwordConfirm: {
        type: String,
        required: [true, 'need  password confirm!!'],
        validate: {
            //This only works on CREATE and SAVE
            validator: function(el) {
                return el === this.password;
            },
            message: 'Password are not the same!'
        }
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
        type: Boolean,
        default: true,
        select: false
    }
});

userSchema.pre('save', async function(next) {
    //Only run this function if password was actually modified
    if (!this.isModified('password')) return next();

    //Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);

    //Delete passwordConfirm field
    this.passwordConfirm = undefined;
    next();
});

userSchema.pre('save', function(next) {
    if (!this.isModified('password') || this.isNew) return next(); ///isNew 是內建屬性, 可以得知是否為新建立的資料

    this.passwordChangedAt = Date.now() - 1000;
    next();
});

//不要在find/findAndUpdate等操作將被刪除的使用者(active: false)給回傳
userSchema.pre(/^find/, function(next) {
    //this points to the current query

    //在getAllUsers函式裡面, 第一行就是 const users = await User.find();
    //此Qurry middleware會在該function之前就先被啟動
    //利用find的filter object 加入 active: true 表示我們只要回傳未被刪除的使用者
    this.find({ active: { $ne: false } });
    next();
});

//建立instance method, 檢查輸入的 password 是否正確
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    console.log('correctPassword-->', candidatePassword, userPassword);
    //candidatePassword是未被加密的明文密碼, userPassword是已被hashed過的密碼
    return await bcrypt.compare(candidatePassword, userPassword);
};

//建立instance method, 檢查jwt發出後, 是否密碼有修改過了, 如果有修改過就要要求使用者重登
userSchema.methods.changedPasswordAfter = async function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    //加密後的Reset Token(passwordResetToken), 保存在資料庫裡, 再把原始的resetToken寄給使用者,
    //之後使用者會把這個resetToken帶過來server, server端再用一樣的加密方式求出passwordResetTokenFromUser,
    //再與database的passwordResetToken比較是否一樣, 若一樣就確定使用者是沒錯的
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    console.log({ resetToken }, this.passwordResetToken);
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
