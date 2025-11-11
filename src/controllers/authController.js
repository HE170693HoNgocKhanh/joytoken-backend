const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOtp } = require("../utils/mailer");

// ✅ [1] Đăng ký tài khoản — gửi OTP qua email
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin." });

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email đã được đăng ký." });

    // Mã hoá mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo mã OTP ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Tạo user mới nhưng chưa xác thực email
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      emailVerified: false,
      emailOtp: otp,
      emailOtpExpires: Date.now() + 3 * 60 * 1000, // 3 phút
    });

    await newUser.save();

    // Gửi OTP qua email
    await sendOtp(email, otp);

    res.status(201).json({
      message: "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.",
      email,
    });
  } catch (error) {
    console.error("❌ Lỗi đăng ký:", error);
    res.status(500).json({ message: "Lỗi server khi đăng ký." });
  }
};

// ✅ [2] Xác thực email qua OTP
// ✅ Xác thực OTP khi đăng ký (chưa đăng nhập)
exports.verifyRegisterOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Thiếu email hoặc mã OTP." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });

    if (user.emailVerified)
      return res.status(400).json({ message: "Email đã được xác thực trước đó." });

    if (user.emailOtp !== otp || user.emailOtpExpires < Date.now()) {
      return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
    }

    user.emailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "✅ Xác thực email thành công! Giờ bạn có thể đăng nhập." });
  } catch (error) {
    console.error("❌ Lỗi xác thực đăng ký:", error);
    res.status(500).json({ message: "Lỗi server khi xác thực OTP đăng ký." });
  }
};

// ✅ [3] Đăng nhập
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Email không tồn tại." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Mật khẩu không đúng." });

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Email chưa được xác thực. Vui lòng xác thực trước khi đăng nhập.",
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.status(200).json({
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi đăng nhập:", error);
    res.status(500).json({ message: "Lỗi server khi đăng nhập." });
  }
};

// ✅ [4] Lấy thông tin user hiện tại (verify token)
exports.getCurrentUser = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      phone: user.phone,
      address: user.address,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("❌ Lỗi lấy thông tin user:", error);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin user." });
  }
};

// ✅ [5] Đăng xuất
exports.logout = async (req, res) => {
  try {
    // Với JWT, logout chủ yếu là client-side (xóa token)
    // Backend chỉ cần trả về success
    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("❌ Lỗi đăng xuất:", error);
    res.status(500).json({ message: "Lỗi server khi đăng xuất." });
  }
};