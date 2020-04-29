const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

//使用情境
// new Email(user, url).sendWelcome();

module.exports = class Email {
    constructor(user, url) {
        this.to = user.email;
        this.firstName = user.name.split(' ')[0];
        this.url = url;
        this.from = `Alex Lin <${process.env.EMAIL_FROM}>`;
    }

    // 1)  Create a transpoter
    //兩種
    newTransport() {
        if (process.env.NODE_ENV === 'production') {
            console.log('newTransport SendGrid!!!');
            //SendGrid
            return nodemailer.createTransport({
                // service: 'SendGrid',
                host: 'smtp.sendgrid.net',
                port: '587',
                auth: {
                    user: process.env.SENDGRID_USERNAME,
                    pass: process.env.SENDGRID_PASSWORD
                }
            });
        }

        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async send(template, subject) {
        //Send the actual email
        //1) Render HTML based on a pug template
        const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
            //我們會將以下的資料送到pug裡去
            firstName: this.firstName,
            url: this.url,
            subject
        });

        //2) Define email options
        const mailOptions = {
            from: this.from,
            to: this.to,
            subject: subject,
            html: html,
            text: htmlToText.fromString(html)
        };

        //3) Create a transport and sens email
        await this.newTransport().sendMail(mailOptions);
    }

    async sendWelcome() {
        await this.send('welcome', 'Welcome to the Natours Family!');
    }

    async sendPasswordReset() {
        await this.send('passwordReset', 'Your password reset token (valid for only 10 minutes');
    }
};
