/*eslint-disable*/
import '@babel/polyfill';
import axios from 'axios';
import { showAlert } from './alerts';

export const login = async (email, password) => {
    try {
        //使用axios第三方HTTP req套件, 對我們的loing API發送 POST req
        const res = await axios({
            method: 'POST',
            url: 'http://127.0.0.1:3000/api/v1/users/login',
            data: {
                email: email,
                password: password
            }
        });

        //axios會將結果存在res.data物件裡
        //在此API會回傳 有 status, token, 和我們自定義的data物件(與上面那個data指的不是同一個的喔)
        //取得role   console.log('Role:', res.data.data.user.role);

        if (res.data.status === 'success') {
            showAlert('success', 'Logged in successfully!');
            window.setTimeout(() => {
                location.assign('/');
            }, 1500);
        }
    } catch (err) {
        showAlert('error', err.response.data.message);
    }
};

export const logout = async () => {
    try {
        const res = await axios({
            method: 'GET',
            url: 'http://127.0.0.1:3000/api/v1/users/logout'
        });

        if (res.data.status === 'success') {
            //reload參數填為 true - Reloads the current page from the server
            location.reload(true);
        }
    } catch (error) {
        showAlert('error', 'Error logging out! Try again.');
    }
};
