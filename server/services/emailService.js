/**
 * Nodemailer Email Service (for password reset etc.)
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendPasswordReset = async (toEmail, resetUrl) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"AI Job Manager" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Password Reset - AI Job Manager',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">AI Job Manager</h2>
        <h3>Password Reset Request</h3>
        <p>You requested a password reset. Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="
          display: inline-block;
          background: #6366f1;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin: 16px 0;
        ">Reset Password</a>
        <p style="color: #666;">This link expires in 10 minutes.</p>
        <p style="color: #666;">If you didn't request this, please ignore this email.</p>
        <hr/>
        <p style="color: #999; font-size: 12px;">AI Job Application Manager</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${toEmail}`);
  } catch (error) {
    logger.error(`Failed to send password reset email: ${error.message}`);
    throw error;
  }
};

module.exports = { sendPasswordReset };
