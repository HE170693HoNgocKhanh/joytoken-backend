const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"

  if (!token)
    return res.status(401).json({ message: "Chưa đăng nhập hoặc thiếu token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Gắn thông tin user vào request
    next();
  } catch (err) {
    res.status(403).json({ message: "Token không hợp lệ hoặc hết hạn" });
  }
};
