/*eslint-disable*/
import axios from 'axios';
import { showAlert } from './alerts';

//我們已經在tour.pug引入了stripe函式庫了, 所以可以直接使用

const stripe = Stripe('pk_test_AM6a9i29a6CDotMkRvX0Hnjz004FC1Wrtm');

export const bookTour = async tourId => {
    try {
        //1) Get checkout session from API
        const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

        // console.log(session);
        //2) Create checkout form + charge credit card
        await stripe.redirectToCheckout({
            //axios會將結果存在session.data物件裡
            sessionId: session.data.session.id
        });
    } catch (err) {
        console.log(err);
        showAlert('error', err);
    }
};
