// src/routers/userRoutes.js
const express = require("express");
const router = express.Router();
const { changeEmailRequest, verifyEmailOtp, getProfile, updateProfile, uploadAvatar } = require("../controllers/userController");
const { verifyToken } = require("../middleware/authMiddleware");
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
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.post("/profile/avatar", verifyToken, upload.single("avatar"), uploadAvatar);

router.post("/change-email", verifyToken, changeEmailRequest);
router.post("/verify-email", verifyToken, verifyEmailOtp);

module.exports = router;
