const express = require('express');
const viewsController = require('./../controllers/viewsController');
const authController = require('./../controllers/authController');
const bookingController = require('./../controllers/bookingController');
const router = new express.Router();

// router.get('/', (req, res) => {
//     res.status(200).render('base', {
//         tour: 'The Forest Hiker',
//         user: 'Alex'
//     });
//     //它會自動去從我們前面所設定的views資料夾去找base.pug檔案出來
//     //另外我們還可以丟物件進去到pug檔裡面使用
// });

//使用authController.isLoggedIn middleware去檢查是否logged in, 乃至於將UI右上角的登入狀態顯示在pug (res.locals.user)
router.get('/', authController.isLoggedIn, viewsController.getOverview);

router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);

// login
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);

router.get('/me', authController.protect, viewsController.getAccount);

router.get(
    '/my-tours',
    /*bookingController.createBookingCheckout,*/ authController.protect,
    viewsController.getMyTours
);

router.post('/submit-user-data', authController.protect, viewsController.updateUserData);

module.exports = router;
