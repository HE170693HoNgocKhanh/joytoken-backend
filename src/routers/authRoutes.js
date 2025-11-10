const express = require('express');
const { register, login } = require('../controllers/authController');
const { verifyRegisterOtp } = require('../controllers/authController');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { registerValidator, loginValidator, verifyEmailValidator } = require('../validators/authValidators');

const router = express.Router();

// ⚙️ Cấu hình multer để upload ảnh đại diện
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars'); // Thư mục lưu ảnh (hãy chắc chắn thư mục này tồn tại)
  },
  filename: (req, file, cb) => {
    const safeName = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    cb(null, `${safeName}${path.extname(file.originalname || "")}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file && file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép tải lên file ảnh'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}); // ✅ Định nghĩa upload ở đây

// ------------------- ROUTES -------------------

// AUTH
router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);

// EMAIL
router.post('/verify-email', verifyEmailValidator, verifyRegisterOtp );

module.exports = router;
