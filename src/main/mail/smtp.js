const nodemailer = require('nodemailer');
const { decrypt } = require('../security');
const { getConfig } = require('../config');
const { isNeteaseEmail } = require('./imap');

async function sendMail(account, mail) {
  const config = getConfig();
  const password = config.security.encryptCredentials ? decrypt(account.password) : account.password;

  const transporterOptions = {
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.port === 465,
    auth: {
      user: account.email,
      pass: password
    }
  };

  // 网易邮箱兼容
  if (isNeteaseEmail(account.email)) {
    transporterOptions.tls = {
      ciphers: 'SSLv3'
    };
  }

  const transporter = nodemailer.createTransport(transporterOptions);

  const mailOptions = {
    from: account.email,
    to: mail.to,
    subject: mail.subject,
    text: mail.body,
    html: mail.html || null
  };

  await transporter.sendMail(mailOptions);
  return true;
}

module.exports = { sendMail };