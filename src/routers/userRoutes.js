// src/routers/userRoutes.js
const express = require("express");
const router = express.Router();
const {
  changeEmailRequest,
  verifyEmailOtp,
  getProfile,
  updateProfile,
  uploadAvatar,
  getAllUser,
  updateByAdmin,
  getDashboardStatistics,
  getDailyRevenueReport,
  deleteUser,
} = require("../controllers/userController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");

//  Cấu hình multer để upload ảnh đại diện
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/avatars");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ✅ Routes
router.get("/get-all", verifyToken, requireRole(["admin"]), getAllUser);
router.get(
  "/statistics",
  verifyToken,
  requireRole(["admin"]),
  getDashboardStatistics
);

router.get(
  "/revenue/daily",
  verifyToken,
  requireRole(["admin"]),
  getDailyRevenueReport
);

router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.put(
  "/update-by-admin/:id",
  verifyToken,
  requireRole(["admin"]),
  updateByAdmin
);

router.post(
  "/profile/avatar",
  verifyToken,
  upload.single("avatar"),
  uploadAvatar
);

router.post("/change-email", verifyToken, changeEmailRequest);
router.post("/verify-email", verifyToken, verifyEmailOtp);

router.delete("/:id", verifyToken, requireRole(["admin"]), deleteUser);

module.exports = router;
