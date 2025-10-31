<<<<<<< HEAD:src/controller/userController.js
const User = require("../models/User");

// Lấy tất cả user
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.creatUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy user theo ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật user
exports.updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select("-password");
    if (!updatedUser)
      return res.status(404).json({ message: "Không tìm thấy user" });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Xóa user
exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy user" });
    res.json({ message: "Đã xóa user thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
=======
const User = require('../models/User');
const nodemailer = require('nodemailer');

// ✅ Lấy thông tin người dùng
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin user' });
  }
};

// ✅ Cập nhật thông tin cơ bản
exports.updateProfile = async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, address, phone },
      { new: true }
    ).select('-password');

    res.json({ message: 'Cập nhật thành công', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật thông tin' });
  }
};

// ✅ Upload avatar
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Chưa chọn ảnh' });

    const imageUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: imageUrl },
      { new: true }
    ).select('-password');

    res.json({ message: 'Cập nhật ảnh đại diện thành công', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải ảnh' });
  }
};

// ✅ Gửi mã xác thực đến email mới
exports.changeEmailRequest = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ message: 'Thiếu email mới' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // OTP 6 số dạng string

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    user.tempEmail = newEmail;
    user.emailOtp = otp;
    user.emailOtpExpires = Date.now() + 5 * 60 * 1000; // 5 phút
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"JoyToken" <${process.env.GMAIL_USER}>`,
      to: newEmail,
      subject: 'Xác thực thay đổi email',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 16px;">
          <h2>Xin chào ${user.name || ''},</h2>
          <p>Bạn vừa yêu cầu thay đổi email cho tài khoản <b>JoyToken</b>.</p>
          <p>Mã OTP của bạn là:</p>
          <h1 style="color:#007BFF; letter-spacing: 3px;">${otp}</h1>
          <p>OTP sẽ hết hạn trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
      `,
    });

    res.json({ message: 'Đã gửi mã xác thực đến email mới.' });
  } catch (error) {
    console.error('❌ Lỗi gửi email:', error);
    res.status(500).json({ message: 'Lỗi gửi email xác thực' });
  }
};

// ✅ Xác minh mã OTP email
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'Thiếu mã OTP' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    // So sánh OTP và kiểm tra hạn
    if (user.emailOtp === otp && user.emailOtpExpires > Date.now()) {
      user.email = user.tempEmail;
      user.tempEmail = undefined;
      user.emailOtp = undefined;
      user.emailOtpExpires = undefined;
      user.emailVerified = true;
      await user.save();
      res.json({ message: '✅ Email đã được xác thực thành công.' });
    } else {
      res.status(400).json({ message: '❌ OTP không hợp lệ hoặc đã hết hạn.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi xác thực email' });
>>>>>>> 15b4ee6 (refactor: move controllers to src/controllers, add email OTP logic):src/controllers/userController.js
  }
};
