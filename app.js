const path = require('path');
const express = require('express');
const morgan = require('morgan'); //把console的 status code 高亮化

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
//const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');

const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

//Start express app
const app = express();

//Template view engine, 用來在server端render出網頁送給client端
//Express 有support
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

//載入靜態資源, 可直接輸入url存取public底下的所有資源
// http://127.0.0.1:3000/overview.html  因為指定public為根目錄, 所以路徑不需要加public
//app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

//1) Global Middlewares, morgan, help to investigate the accessing API url
//Helmet 會適當設定 HTTP 標頭，有助於防範您的應用程式出現已知的 Web 漏洞。
//Helmet 實際上只由 9 個小型中介軟體函數組成，這些函數會設定安全相關的 HTTP 標頭：
app.use(helmet());

console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

//限制同一個IP在1小時內發出的請求不能超過100個
const limiter = rateLimit({
    max: 100,
    windowsMs: 60 * 60 * 1000,
    message: 'Too many request from this IP, please try again in an hour!'
});

app.use('/api', limiter);

//Reading data from body into req.body
//限制傳送的內文不可超過10kb
app.use(express.json({ limit: '10kb' }));

app.use(express.urlencoded({ extended: true, limit: '10kb' }));

//取出Client端每次request傳過來所帶的cookie, 它會將cookie存放到 req.cookies物件裡
app.use(cookieParser());

//Data sanitization against NoSQL query injection
app.use(mongoSanitize());

//Data sanitization against XSS, 將一些使用者故意輸入的HTML code轉碼, 如 < 變成 &lt;
app.use(xss());

//Prevent parameter pollution, 如queryString放了兩個重複的field:  ?sort=duration&sort=price
// app.use(
//     hpp({
//         whitelist: ['duration', 'ratingsAverage', 'ratingsQuantity', 'maxGroupSize', 'difficulty', 'price']
//     })
// );

//Our Own Middleware
app.use((req, res, next) => {
    //對req物件新增一個property儲存'請求時間'
    req.requestTime = new Date().toISOString();
    next();
});

app.use('/', viewRouter); //Middleware
app.use('/api/v1/tours', tourRouter); //Middleware
app.use('/api/v1/users', userRouter); //Middleware
app.use('/api/v1/reviews', reviewRouter); //Middleware
app.use('/api/v1/bookings', bookingRouter); //Middleware

//2) Route handlers
//舊式http method呼叫處理的handler:
//上面兩個一樣的url, 下面三個一樣的url
// app.get('/api/v1/tours', getAllTour);
// app.post('/api/v1/tours', createTour);
// app.get('/api/v1/tours/:id', getTour);
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);

//當source code能跑到這邊來, 就表示輸入的url格式並不符合上面的middleware所定義的, 也就表示使用者輸入了一個非法的路徑
//如果沒有以下的code, mongoose會自動幫我們生成一個404 HTML頁面給前端
//API正常來說是不會回送HTML格式的頁面, 因此自訂錯誤JSON格式
//使用app.all針對所有HTTP method: get/post/delete進行分析, URL '*', 表示所有未被handle的路徑
app.all('*', (req, res, next) => {
    // const err = new Error(`Can't find ${req.originalUrl} on this server!`);
    // err.status = 'fail';
    // err.statusCode = 404;
    //next(err); //當next放進了參數, express自動辨認為此為error, 則會略過後面其他middleware, 直接跳到處理error的global middleware

    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

//建立一個全域的error hanlder, 處理錯誤, 只要use後面帶四個參數, express就自動將辨別此為error handling middleware
//第一個參數帶的必為error物件
app.use(globalErrorHandler);

module.exports = app; //export給server.js使用
