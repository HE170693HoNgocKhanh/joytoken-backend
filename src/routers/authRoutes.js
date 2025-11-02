const express = require('express');
const { register, login } = require('../controllers/authController');
const { verifyRegisterOtp } = require('../controllers/authController');
const multer = require('multer');

const router = express.Router();

// ⚙️ Cấu hình multer để upload ảnh đại diện
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars'); // Thư mục lưu ảnh (hãy chắc chắn thư mục này tồn tại)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage }); // ✅ Định nghĩa upload ở đây

// ------------------- ROUTES -------------------

// AUTH
router.post('/register', register);
router.post('/login', login);

// EMAIL
router.post('/verify-email', verifyRegisterOtp );

module.exports = router;
