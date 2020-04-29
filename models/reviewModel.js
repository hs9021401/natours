const mongoose = require('mongoose');
const Tour = require('./tourModel');
//review /rating / createdAt/ ref to tour/ ref to user

const reviewSchema = new mongoose.Schema(
    {
        review: {
            type: String,
            required: [true, 'Review can not be empty!']
        },
        rating: {
            type: Number,
            min: [1, 'Rating must be above 1.0'],
            max: [5, 'Rating must be below 5.0']
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        tour: {
            type: mongoose.Schema.ObjectId,
            ref: 'Tour',
            required: [true, 'Review must belong to a tour']
        },
        user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'Review must belong to a user']
        }
    },
    {
        //如果有使用到virtual, 則需要在這裡新加這兩行, 才會將值給回傳
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

//設定user對於一個tour只能有一個review, 但是在mongoose有時候會失效
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'user',
        select: 'name photo'
    });

    next();
});

//建立calcAverageRatings靜態函式計算平均評分
reviewSchema.statics.calcAverageRatings = async function(tourId) {
    //this表示本身這個Model, Model又有aggregate的這個方法可以使用
    const stats = await this.aggregate([
        {
            $match: { tour: tourId }
        },
        {
            $group: {
                _id: '$tour',
                nRating: { $sum: 1 }, //rating個數
                avgRating: { $avg: '$rating' }
            }
        }
    ]);

    if (stats.length > 0) {
        //當stats陣列被砍光光沒有東西的話, 就把quantity設為0, 評分設為預設4.5
        //將統計完的結果存到各欄位裡
        await Tour.findByIdAndUpdate(tourId, { ratingsQuantity: stats[0].nRating, ratingsAverage: stats[0].avgRating });
    } else {
        await Tour.findByIdAndUpdate(tourId, { ratingsQuantity: 0, ratingsAverage: 4.5 });
    }
};

//Document Middleware- this指向當前document
//每次新增review後會進行save動作, 再呼叫satic function計算統計
reviewSchema.post('save', function() {
    // this points to current review
    this.constructor.calcAverageRatings(this.tour);
});

//Query Middleware- this指向當前query
//findByIdAndUpdate
//findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function(next) {
    //this是query物件, 將取得的Document使用this.r塞到this物件裡面去, 這樣就可以在 post middleware存取(需要等到update/delete後才計算, 所以我們需要帶到post middle在計算統計)
    this.r = await this.findOne();
    console.log(this.r);
    next();
});

reviewSchema.post(/^findOneAnd/, async function() {
    //this.r = await this.findOne(); does NOT work here, query has already executed
    await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
