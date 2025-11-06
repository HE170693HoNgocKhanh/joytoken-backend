const User = require("../models/User");
const Category = require("../models/Category");
const Order = require("../models/Order");
const Product = require("../models/Product");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const nodemailer = require("nodemailer");

// ✅ Lấy thông tin người dùng
exports.getProfile = async (req, res) => {
  try {
    console.log("📥 Get profile request");
    console.log("👤 User from token:", req.user?._id);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }
    
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }
    
    console.log("✅ Profile retrieved:", user._id);
    res.json(user);
  } catch (error) {
    console.error("❌ Error getting profile:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin user", error: error.message });
  }
};

// ✅ Cập nhật thông tin cơ bản
exports.updateProfile = async (req, res) => {
  try {
    console.log("📝 Update profile request:", req.body);
    console.log("👤 User ID:", req.user?._id);
    
    const { name, address, phone } = req.body;
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }
    
    // Validate dữ liệu đầu vào
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Họ và tên không được để trống" });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (phone !== undefined) {
      updateData.phone = phone && typeof phone === 'string' ? phone.trim() : (phone || "");
    }
    if (address !== undefined) {
      updateData.address = address && typeof address === 'string' ? address.trim() : (address || "");
    }

    console.log("💾 Updating user with data:", updateData);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      console.log("❌ User not found after update");
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    console.log("✅ Profile updated successfully:", user._id);
    console.log("📋 Updated user data:", {
      name: user.name,
      phone: user.phone,
      address: user.address
    });
    
    res.json({ message: "Cập nhật thành công", user });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    
    // Xử lý lỗi validation từ Mongoose
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ 
        message: "Dữ liệu không hợp lệ", 
        error: validationErrors 
      });
    }
    
    res.status(500).json({ message: "Lỗi khi cập nhật thông tin", error: error.message });
  }
};

// ✅ Upload avatar
exports.uploadAvatar = async (req, res) => {
  try {
    console.log("📤 Upload avatar request received");
    console.log("File info:", {
      filename: req.file?.filename,
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
      path: req.file?.path
    });
    console.log("User ID:", req.user?._id);

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    if (!req.file) {
      console.log("❌ No file in request");
      return res.status(400).json({ message: "Chưa chọn ảnh" });
    }

    // Tạo URL cho ảnh
    const imageUrl = `/uploads/avatars/${req.file.filename}`;
    console.log("💾 Saving avatar URL:", imageUrl);
    console.log("📁 File saved at:", req.file.path);

    // Cập nhật avatar trong database
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: imageUrl },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    console.log("✅ Avatar updated successfully for user:", user._id);
    console.log("🖼️ Avatar URL in DB:", user.avatar);
    
    res.json({ 
      message: "Cập nhật ảnh đại diện thành công", 
      user 
    });
  } catch (error) {
    console.error("❌ Error uploading avatar:", error);
    res.status(500).json({ 
      message: "Lỗi khi tải ảnh", 
      error: error.message 
    });
  }
};

// ✅ Gửi mã xác thực đến email mới
exports.changeEmailRequest = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ message: "Thiếu email mới" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // OTP 6 số dạng string

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    user.tempEmail = newEmail;
    user.emailOtp = otp;
    user.emailOtpExpires = Date.now() + 5 * 60 * 1000; // 5 phút
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"JoyToken" <${process.env.GMAIL_USER}>`,
      to: newEmail,
      subject: "Xác thực thay đổi email",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 16px;">
          <h2>Xin chào ${user.name || ""},</h2>
          <p>Bạn vừa yêu cầu thay đổi email cho tài khoản <b>JoyToken</b>.</p>
          <p>Mã OTP của bạn là:</p>
          <h1 style="color:#007BFF; letter-spacing: 3px;">${otp}</h1>
          <p>OTP sẽ hết hạn trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
      `,
    });

    res.json({ message: "Đã gửi mã xác thực đến email mới." });
  } catch (error) {
    console.error("❌ Lỗi gửi email:", error);
    res.status(500).json({ message: "Lỗi gửi email xác thực" });
  }
};

// ✅ Xác minh mã OTP email
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: "Thiếu mã OTP" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    // So sánh OTP và kiểm tra hạn
    if (user.emailOtp === otp && user.emailOtpExpires > Date.now()) {
      user.email = user.tempEmail;
      user.tempEmail = undefined;
      user.emailOtp = undefined;
      user.emailOtpExpires = undefined;
      user.emailVerified = true;
      await user.save();
      res.json({ message: "✅ Email đã được xác thực thành công." });
    } else {
      res.status(400).json({ message: "❌ OTP không hợp lệ hoặc đã hết hạn." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi xác thực email" });
  }
};

// ===== Wishlist APIs =====
exports.getWishlist = async (req, res) => {
  try {
    console.log("📥 Get wishlist request");
    console.log("👤 User ID:", req.user?._id);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }
    
    const user = await User.findById(req.user._id).populate('wishlist', 'name image price');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }
    
    console.log("✅ Wishlist retrieved:", user.wishlist?.length || 0, "items");
    res.json({ success: true, data: user.wishlist || [] });
  } catch (error) {
    console.error("❌ Error getting wishlist:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    console.log("➕ Add to wishlist request");
    console.log("👤 User ID:", req.user?._id);
    console.log("📦 Product ID:", req.params.productId);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }
    
    const { productId } = req.params;
    const product = await Product.findById(productId).select('_id');
    if (!product) {
      return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { wishlist: productId } },
      { new: true }
    ).populate('wishlist', 'name image price');

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    console.log("✅ Product added to wishlist. Total items:", user.wishlist?.length || 0);
    res.json({ success: true, data: user.wishlist });
  } catch (error) {
    console.error("❌ Error adding to wishlist:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    console.log("➖ Remove from wishlist request");
    console.log("👤 User ID:", req.user?._id);
    console.log("📦 Product ID:", req.params.productId);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }
    
    const { productId } = req.params;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { wishlist: productId } },
      { new: true }
    ).populate('wishlist', 'name image price');

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    console.log("✅ Product removed from wishlist. Total items:", user.wishlist?.length || 0);
    res.json({ success: true, data: user.wishlist });
  } catch (error) {
    console.error("❌ Error removing from wishlist:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllUser = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách người dùng" });
  }
};

exports.updateByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, emailVerified } = req.body;
    // console.log(id);
    const user = await User.findByIdAndUpdate(
      id,
      { role, emailVerified },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi cập nhật người dùng" });
  }
};

exports.getDashboardStatistics = async (req, res) => {
  try {
    const countCustomers = await User.countDocuments({ role: "customer" });
    const countCategories = await Category.countDocuments();
    const countProducts = await Product.countDocuments();
    const countPrice = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } },
    ]);
    const totalRevenue = countPrice[0]?.totalRevenue || 0;

    res.json({
      success: true,
      totalCustomers: countCustomers,
      totalCategories: countCategories,
      totalProducts: countProducts,
      totalRevenue: totalRevenue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi đếm số lượng khách hàng" });
  }
};

exports.getDailyRevenueReport = async (req, res) => {
  try {
    const dateParam =
      req.query.date || dayjs().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");

    const startOfDay = dayjs(dateParam).startOf("day").toDate();
    const endOfDay = dayjs(dateParam).endOf("day").toDate();

    console.log("BE nhận:", req.query.date);
    console.log(
      "Start (VN):",
      dayjs(startOfDay).tz("Asia/Ho_Chi_Minh").format()
    );
    console.log("End (VN):", dayjs(endOfDay).tz("Asia/Ho_Chi_Minh").format());

    // 🔹 Lấy toàn bộ đơn hàng trong ngày, có populate user
    const orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    // ✅ Thống kê tổng quan
    const totalOrders = orders.length;
    const paidOrders = orders.filter((o) => o.isPaid).length;
    const unpaidOrders = totalOrders - paidOrders;
    const totalRevenue = orders
      .filter((o) => o.isPaid)
      .reduce((sum, o) => sum + o.totalPrice, 0);

    // ✅ Gom thống kê theo phương thức thanh toán
    const paymentSummary = {};
    for (const o of orders) {
      const method = o.paymentMethod || "Unknown";
      if (!paymentSummary[method]) {
        paymentSummary[method] = { total: 0, count: 0 };
      }
      if (o.isPaid) paymentSummary[method].total += o.totalPrice;
      paymentSummary[method].count += 1;
    }

    // ✅ Gom theo trạng thái đơn hàng
    const statusSummary = {};
    for (const o of orders) {
      const status = o.status || "Unknown";
      if (!statusSummary[status]) statusSummary[status] = 0;
      statusSummary[status]++;
    }

    // ✅ Dữ liệu chi tiết cho bảng frontend
    const orderDetails = orders.map((o) => ({
      id: o._id,
      customerName: o.userId?.name || "Khách vãng lai",
      customerEmail: o.userId?.email,
      paymentMethod: o.paymentMethod,
      totalItems: o.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: o.totalPrice,
      discount: o.discountAmount || 0,
      isPaid: o.isPaid,
      isDelivered: o.isDelivered,
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
    }));

    // ✅ Trả về kết quả
    res.json({
      success: true,
      date: dateParam,
      totalOrders,
      paidOrders,
      unpaidOrders,
      totalRevenue,
      paymentSummary,
      statusSummary,
      orders: orderDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy báo cáo doanh thu hàng ngày",
      error: error.message,
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Xoa nguoi dung thanh cong",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
