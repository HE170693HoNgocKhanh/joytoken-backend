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
const {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator,
  productIdParamValidator,
} = require('../validators/reviewValidators');

const router = express.Router();

// Public routes
router.get('/product/:productId', productIdParamValidator, getProductReviews);

// Protected routes - Customer
router.post('/', verifyToken, createReviewValidator, createReview);
router.get('/my-reviews', verifyToken, getMyReviews);
router.put('/:id', verifyToken, reviewIdParamValidator, updateReviewValidator, updateReview);
router.delete('/:id', verifyToken, reviewIdParamValidator, deleteReview);

// Protected routes - Admin
router.get('/', verifyToken, requireRole(['admin']), getAllReviews);
router.put('/:id/verify', verifyToken, requireRole(['admin']), reviewIdParamValidator, verifyReview);

module.exports = router;