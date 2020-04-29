const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
const validator_lib = require('validator');

//建立資料藍圖schema, 作用類似JAVA的class
const tourSchema = new mongoose.Schema(
    {
        name: {
            //Schema type options, 如果想要讓name這個property有更多的設定, 就可以這樣寫, 不然的話就只要直接寫name: String即可
            type: String,
            required: [true, 'A tour must have a name'], //a validator, 使用矩陣存放, 第二個參數可以擺放錯誤訊息
            unique: true,
            trim: true,
            maxlength: [40, 'A tour name must have less or equal lenth then 40 characters!'],
            minlength: [10, 'A tour name must have more or equal lenth then 10 characters!']
            // validate: [validator_lib.isAlpha, 'Tour name must only contain characters']  //使用第三方函式庫, 檢查輸入的是否僅有字母
        },
        slug: String,
        duration: {
            type: Number,
            required: [true, 'A tour must have a duration']
        },
        maxGroupSize: {
            type: Number,
            required: [true, 'A tour must have a group size']
        },
        difficulty: {
            type: String,
            required: [true, 'A tour must  have a difficulty'],
            //限定使用者輸入的字串有哪些
            enum: {
                values: ['easy', 'medium', 'difficult'],
                message: 'Difficulty is either: easy, medium or difficult'
            }
        },
        ratingsAverage: {
            type: Number,
            default: 4.5, //如果當我們新增一個新的document卻無指定rating值, 此方法設定就可設定其初始值為4.5
            min: [1, 'Rating must be above 1.0'],
            max: [5, 'Rating must be below 5.0'],
            set: val => Math.round(val * 10) / 10 //setter function會每次有new value時會執行. 我們想要此欄位只取到小數第一位, 4.66666->46.6666->47->4.7
        },
        ratingsQuantity: {
            type: Number,
            default: 0
        },
        price: {
            type: Number,
            required: [true, 'A tour must have a price']
        },
        priceDiscount: {
            type: Number,
            //Customized validator, 當discount值 大於 price 就回報錯誤
            validate: {
                validator: function(val) {
                    //this only point to current doc on NEW document creation!!!
                    return val < this.price;
                },
                // message: 'Discount price ({VALUE}) should be below regular price' // {VALUE} 在這裡就等於val, 或可以寫成下方
                message: props => `Discount price(${props.value}) should be below regular price`
            }
        },
        summary: {
            type: String,
            trim: true,
            required: [true, 'A tour must have a summary']
        },
        description: {
            type: String,
            trim: true
        },
        imageCover: {
            type: String,
            required: [true, 'A tour must have a cover image']
        },
        images: [String], //矩陣
        createdAt: {
            type: Date,
            default: Date.now,
            select: false //select設為false就不會回傳此欄位了
        },
        startDates: [Date],
        secretTour: {
            type: Boolean,
            default: false
        },
        startLocation: {
            type: {
                //Nested field
                type: String,
                default: 'Point',
                enum: ['Point']
            },
            coordinates: [Number],
            address: String,
            description: String
        },
        locations: [
            //矩陣, 存放以下所定義的Object
            {
                type: {
                    type: String,
                    default: 'Point',
                    enum: ['Point']
                },
                coordinates: [Number],
                address: String,
                description: String,
                day: Number
            }
        ],
        guides: [
            //定義矩陣存放多個guide的id (使用reference方式, 不會將guide的所有資料embeded進來)
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User' //Create a reference to another model
            }
        ]
    },
    {
        //如果有使用到virtual, 則需要在這裡新加這兩行, 才會將值給回傳
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

//建立索引可以提高查詢速度
tourSchema.index({ price: 1, ratingsAverage: -1 }); //複合索引. schema level, 1是正序，-1是倒序
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

//建立虛擬的property, 該欄位是不會被存到database的, 例如距離有公里和英里, 但通常我們不會建立兩個, 而是設計一個虛擬的property去暫存
tourSchema.virtual('durationWeeks').get(function() {
    return this.duration / 7;
});

//建立一個virtual property: 'reviews'
//Virtual populate, 不會存在database的虛擬欄位
//取回tour時, 新增一個reviews欄位, 該欄位參照Review資料表
tourSchema.virtual('reviews', {
    ref: 'Review',
    foreignField: 'tour',
    localField: '_id'
});

//DOCUMENT MIDDLEWARE
// runs before .save() create()
//第一個參數可放save,validate,remove,updateOne,deleteOne,init
//Pre middleware functions are executed one after another, when each middleware calls next
tourSchema.pre('save', function(next) {
    this.slug = slugify(this.name, { lower: true });
    next();
});

// tourSchema.pre('save', async function(next) {
//     //原本的this.guides存放的是id陣列, 我們要將id替換成User完整資料的陣列
//     const guidesPromises = this.guides.map(async id => await User.findById(id)); //async id => await User.findById(id) 會回傳一個Promise array, 我們必須等他們所有執行完, 所以使用Promise.all
//     this.guides = await Promise.all(guidesPromises);
//     next();
// });

// tourSchema.pre('save', function(next) {
//     console.log('Will save document...');
//     next();
// });

// tourSchema.post('save', function(doc, next) {
//     console.log(doc);
//     next();
// });

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function(next) {
    //針對所有find的操作進行過濾, 我們不想讓secrectTour直接被截取到 (find, findOne, findOneAndDelete, findOneAndRemove, findOneAndUpdate)
    //在此, this表示的是一個Query物件
    //過濾掉secretTour為true的tour
    this.find({ secretTour: { $ne: true } });
    this.start = Date.now();
    next();
});

tourSchema.pre(/^find/, function(next) {
    //populate的作用是將reference的資料(定義在tourSchema裡的guides)fill up with 實際的值, 但是在getAllTour也會需要用到, 所以我們會加在tourModel裡的Query Middleware
    //若要濾掉一些不需要的欄位, 可以建立一個object參數, 並指定path, select參數填入要濾掉的欄位, 前面加上一個減號即可
    this.populate({
        path: 'guides',
        select: '-__v -passwordChangeAt'
    });
    next();
});

tourSchema.post(/^find/, function(doc, next) {
    console.log(`Query took ${Date.now() - this.start} milliseconds!`);
    //console.log(doc);
    next();
});

// AGGREGATION MIDDLEWARE
tourSchema.pre('aggregate', function(next) {
    //因為secret tour在aggregate統計會把它給算進去, 因此我們可以用aggragation middleware 去濾掉它
    //使用this.pipeline() 可取出aggregation的所有條件參數物件
    //解決方法就是是在aggregation條件參數物件最前面加上另外一$match去濾掉, 使用unshift可以在陣列最前面加上另外一個元素
    // this.pipeline().unshift({
    //     $match: {
    //         secretTour: { $ne: true }
    //     }
    // });
    // console.log(this.pipeline());
    next();
});

//建立Model, 之後的操作都是用Model建立(new)出一個實例(instance)
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
