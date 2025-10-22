const express = require('express');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBySeller
} = require('../controller/productController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Protected routes
router.post('/', verifyToken, requireRole(['seller', 'admin']), createProduct);
router.put('/:id', verifyToken, requireRole(['seller', 'admin']), updateProduct);
router.delete('/:id', verifyToken, requireRole(['seller', 'admin']), deleteProduct);

// Seller routes
router.get('/seller/my-products', verifyToken, requireRole(['seller', 'admin']), getProductsBySeller);
router.get('/seller/:sellerId', getProductsBySeller);

module.exports = router;