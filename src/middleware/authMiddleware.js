const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Chưa đăng nhập hoặc thiếu token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
    
    // Lấy thông tin user từ database để có role và thông tin mới nhất
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: "User không tồn tại" });
    }
    
    req.user = user; // Gắn thông tin user vào request (có _id)
    next();
  } catch (err) {
    console.error("❌ Token verification error:", err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ message: "Token đã hết hạn" });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: "Token không hợp lệ" });
    }
    return res.status(403).json({ message: "Token không hợp lệ hoặc hết hạn" });
  }
};

// Middleware kiểm tra role
exports.requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Bạn không có quyền truy cập chức năng này" 
      });
    }

    next();
  };
};
