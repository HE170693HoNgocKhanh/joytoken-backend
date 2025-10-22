const express = require('express');
const { register, login } = require('../controller/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', verifyToken, (req, res) => {
  res.json({ message: 'Đã xác thực token!', user: req.user });
});

module.exports = router;
