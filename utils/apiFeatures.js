class APIFeatures {
    //雖命名為queryString 其實是req.query, JSON物件, 可以用dot運算子取出各個設定值
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    filter() {
        const queryObj = { ...this.queryString }; //利用...取出所有的field, 再用花括號重新建立新物件, 以達到Deep Copy的目的, 其後面如果使用到了delete, 會連帶將原本的req.qurey給修改到了
        const excludedFields = ['page', 'sort', 'limit', 'fields']; //排除一些關鍵字, 這些不是用來搜索的, 而是有其他作用:譬如排序, 分頁等
        excludedFields.forEach(el => delete queryObj[el]);

        let queryStr = JSON.stringify(queryObj);

        //當加入了大小於條件, 如找價格大於500. http://127.0.0.1:3000/api/v1/tours?price[gte]=500
        //回傳的req.query物件會是這樣 { price: { gte: '500' } }
        //但mongoDB合法的 { price: { $gte: '500' } } 是要加上錢符號, 因此做以下後製
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

        this.query = this.query.find(JSON.parse(queryStr));

        return this;
    }

    sort() {
        if (this.queryString.sort) {
            //API使用方式:  sort('price ratingsAverage')  若加上空白再加上第二條件表示: 當price一樣, 就會以ratingAverage做排序
            //若條件前面加上-號, 則會遞減方式排序
            //在URL query string部份我們通常會用逗號串聯第二個條件, 如下
            //127.0.0.1:3000/api/v1/tours?sort=-price,-ratingsAverage
            //這時就要手動切割query string並使用join加上空白串起來

            const sortBy = this.queryString.sort.split(',').join(' ');

            this.query = this.query.sort(sortBy);
        } else {
            //當使用者沒有指定, 我們加上一個預設的排序, 按照建立時間
            this.query = this.query.sort('-createdAt');
        }

        return this;
    }

    limitFields() {
        //限定回傳某些欄位 http://127.0.0.1:3000/api/v1/tours?fields=name,duration,difficulty,price
        //或者回傳要排除的欄位前面加個負號 - 即可
        //select用法是 req.query.select(name price duration) 欄位之間用空白隔開
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            //當使用者沒有指定, 我們回傳client所有資料但排除mongoDB內建欄位 __v (因為此欄位對使用者無意義)
            this.query = this.query.select('-__v');
        }
        return this;
    }

    paginate() {
        const page = this.queryString.page * 1 || 1; //  || 符號後面接的是Default value, JS 獨有的寫法
        const limit = this.queryString.limit * 1 || 100; //每一頁回傳筆數

        const skip = (page - 1) * limit;
        // page=2&limit=10, 1-10, page 1, 11-20, page 2
        this.query = this.query.skip(skip).limit(limit); //去掉前skip筆資料, 回傳limit筆資料

        return this;
    }
}

module.exports = APIFeatures;
