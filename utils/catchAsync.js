module.exports = fn => {
    //為了不讓exports.createTour等於一個函式執行完的回傳值, 這裡直接return
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
