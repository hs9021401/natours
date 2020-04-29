const express = require('express');
const tourController = require('./../controllers/tourController');
const authController = require('./../controllers/authController');

const reviewRouter = require('./../routes/reviewRoutes');
const router = new express.Router();

//取得名為id的param, 並將他丟進middleware檢查
// router.param('id', tourController.checkID);

//POST /tours/tourID_2323254/reviews
//GET /tours/tourID_2323254/reviews

//我們將 {{URL}}api/v1/tours/5c88fa8cf4afda39709c2974/reviews
//利用use方式轉介到reviewRouter, 但是在reviewRoutes所使用到的reviewController無法直接取得:tourId這個參數,
//因此在reviewRoutes.js router使用參數 { mergeParams: true }就可以把:tourId傳過去使用了
router.use('/:tourId/reviews', reviewRouter);

//建立取得前五名便宜的資料, 建立一個middleware, 處理req.query參數, 之後再丟到getAllTour裡
router.route('/top-5-cheap').get(tourController.aliasTopTours, tourController.getAllTour);

//使用aggregate API, 做分組統計
router.route('/tour-stats').get(tourController.getTourStats);

//取得該年度, 最忙碌的月份
router
    .route('/monthly-plan/:year')
    .get(
        authController.protect,
        authController.restrictTo('admin', 'lead-guide', 'guide'),
        tourController.getMonthlyPlan
    );

//取得某距離內所有的tour
router.route('/tours-within/:distance/center/:latlng/unit/:unit').get(tourController.getToursWithin);
//tours-within/distance/233/center/-40,45/unit/mi

//取得目前所在的地方到各個tour的距離
router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
    .route('/')
    .get(tourController.getAllTour)
    .post(authController.protect, authController.restrictTo('admin', 'lead-guide'), tourController.createTour); //middleware鍊, 建立檢查body的name/price是否為空

//帶有id的url
router
    .route('/:id')
    .get(tourController.getTour)
    .patch(
        authController.protect,
        authController.restrictTo('admin', 'lead-guide'),
        tourController.uploadTourImages,
        tourController.resizeTourImages,
        tourController.updateTour
    )
    .delete(authController.protect, authController.restrictTo('admin', 'lead-guide'), tourController.deleteTour);

module.exports = router;
