require("dotenv").config();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function sendOtp(to, otp) {
  const mailOptions = {
    from: `"JoyToken" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Xác thực thay đổi email",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 16px;">
        <h2>Xin chào!</h2>
        <p>Bạn vừa yêu cầu thay đổi email trong ứng dụng <b>JoyToken</b>.</p>
        <p>Mã xác thực (OTP) của bạn là:</p>
        <h1 style="color:#007BFF; letter-spacing: 3px;">${otp}</h1>
        <p>OTP có hiệu lực trong 3 phút. Vui lòng không chia sẻ mã này với ai khác.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Gửi OTP thành công đến:", to);
  } catch (error) {
    console.error("❌ Lỗi khi gửi email:", error);
  }
}

module.exports = { sendOtp };
