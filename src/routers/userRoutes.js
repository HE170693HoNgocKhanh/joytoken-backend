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
  getMonthlyRevenueReport,
  getRevenueChartData,
  getInventoryChartData,
  getUserChartData,
  deleteUser,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getStaffSellerAdmin,
  getChatableUsers,
} = require("../controllers/userController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const {
  updateProfileValidator,
  changeEmailRequestValidator,
  verifyEmailOtpValidator,
  updateByAdminValidator,
  userIdParamValidator,
  productIdParamValidator,
} = require("../validators/userValidators");
const multer = require("multer");
const path = require("path");

//  Cấu hình multer để upload ảnh đại diện
const fs = require("fs");
const uploadsDir = path.join(__dirname, "../../uploads/avatars");

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// File filter để chỉ chấp nhận ảnh
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ có thể tải lên file ảnh!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

// ✅ Routes
router.get("/get-all", verifyToken, requireRole(["admin"]), getAllUser);
router.get("/get-staff-seller-admin", verifyToken, getStaffSellerAdmin);
router.get("/get-chatable-users", verifyToken, requireRole(["admin", "staff", "seller"]), getChatableUsers);

router.get(
  "/statistics",
  verifyToken,
  requireRole(["admin", "staff", "seller"]),
  getDashboardStatistics
);

router.get(
  "/revenue/daily",
  verifyToken,
  requireRole(["admin", "staff", "seller"]),
  getDailyRevenueReport
);

router.get(
  "/revenue/monthly",
  verifyToken,
  requireRole(["admin", "staff", "seller"]),
  getMonthlyRevenueReport
);

router.get(
  "/revenue/chart",
  verifyToken,
  requireRole(["admin"]),
  getRevenueChartData
);

router.get(
  "/inventory/chart",
  verifyToken,
  requireRole(["admin"]),
  getInventoryChartData
);

router.get(
  "/chart/users",
  verifyToken,
  requireRole(["admin"]),
  getUserChartData
);

router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfileValidator, updateProfile);
router.put(
  "/update-by-admin/:id",
  verifyToken,
  requireRole(["admin"]),
  userIdParamValidator,
  updateByAdminValidator,
  updateByAdmin
);

router.post(
  "/profile/avatar",
  verifyToken,
  (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res
              .status(400)
              .json({ message: "Ảnh quá lớn! Tối đa 2MB." });
          }
          return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadAvatar
);

router.post("/change-email", verifyToken, changeEmailRequestValidator, changeEmailRequest);
router.post("/verify-email", verifyToken, verifyEmailOtpValidator, verifyEmailOtp);

router.delete("/:id", verifyToken, requireRole(["admin"]), userIdParamValidator, deleteUser);

// Wishlist
router.get("/wishlist", verifyToken, getWishlist);
router.post("/wishlist/:productId", verifyToken, productIdParamValidator, addToWishlist);
router.delete("/wishlist/:productId", verifyToken, productIdParamValidator, removeFromWishlist);

module.exports = router;
