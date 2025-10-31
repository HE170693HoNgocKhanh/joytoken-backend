const express = require('express');
const {
  createReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  verifyReview
} = require('../controllers/reviewController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/product/:productId', getProductReviews);

// Protected routes - Customer
router.post('/', verifyToken, createReview);
router.get('/my-reviews', verifyToken, getMyReviews);
router.put('/:id', verifyToken, updateReview);
router.delete('/:id', verifyToken, deleteReview);

// Protected routes - Admin
router.get('/', verifyToken, requireRole(['admin']), getAllReviews);
router.put('/:id/verify', verifyToken, requireRole(['admin']), verifyReview);

module.exports = router;