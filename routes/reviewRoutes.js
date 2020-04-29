const express = require('express');
const reviewController = require('./../controllers/reviewController');
const authController = require('./../controllers/authController');

//{ mergeParams: true }
//Preserve the req.params values from the parent router. If the parent and the child have conflicting param names, the child’s value take precedence.
//這樣{{URL}}api/v1/tours/5c88fa8cf4afda39709c295d/reviews, 就會把:tourId帶過來這裡, 然後在reviewController.createReview裡面可以使用到它了!!!
const router = new express.Router({ mergeParams: true });

//protect middleware
router.use(authController.protect);

//下面這兩個url都會跑到下面那個reviewController.createReview Hamndler function
//POST /tours/tourID_2323254/reviews
//GET /tours/tourID_2323254/reviews
//POST /reviews
router
    .route('/')
    .get(reviewController.getAllReviews)
    .post(authController.restrictTo('user'), reviewController.setTourUserIds, reviewController.createReview);

//DELETE
router
    .route('/:id')
    .get(reviewController.getReview)
    .patch(authController.restrictTo('user', 'admin'), reviewController.updateReview)
    .delete(authController.restrictTo('user', 'admin'), reviewController.deleteReview);
module.exports = router;
