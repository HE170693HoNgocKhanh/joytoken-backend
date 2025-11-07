const express = require("express");
const router = express.Router();

const {
  logActivity,
  getActivityTimeline,
} = require("../controllers/trackingController");

const { optionalVerifyToken, verifyToken, requireRole } = require("../middleware/authMiddleware");

// Ghi nhận hoạt động truy cập (không bắt buộc đăng nhập)
router.post("/activity", optionalVerifyToken, logActivity);

// Lấy dữ liệu biểu đồ hoạt động (chỉ admin)
router.get(
  "/activity/timeline",
  verifyToken,
  requireRole(["admin"]),
  getActivityTimeline
);

module.exports = router;

