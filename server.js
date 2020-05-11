const dotenv = require('dotenv');
const mongoose = require('mongoose');

process.on('uncaughtException', err => {
    console.log('UNCAUGHT EXCEPTION!!!');
    console.log(err.name, err.message);
    process.exit(1);
});

dotenv.config({ path: './config.env' }); //讀設定的放到最上面, 因為app會用到, 不能放得比他下面, 不然app那支code會無法使用
const app = require('./app');

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

//此connect會回傳一個Promise, 可以用then去接它
mongoose
    .connect(DB, {
        //To deal with some deprecation warnings. 照樣填寫即可
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true
    })
    .then(() => console.log('DB connection successfully'));

const port = process.env.PORT || 3000; //從process.env變數讀出PORT的設定

const server = app.listen(port, () => {
    console.log(`APP running on port ${port}...`);
});

//捕獲未處理的promise, 例如mongo DB無法連線的時候會發一個unhandledRejection事件, 我們可以用process.on去監聽
process.on('unhandledRejection', err => {
    console.log('UNHANDLED REJECTION!!!');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

process.on('SIGTERM', () => {
    console.log('SIGTERM RECEIVED. Shutting down gracefully.');
    server.close(() => {
        console.log('Process terminated');
    });
});
