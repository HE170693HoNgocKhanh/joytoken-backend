const express = require('express');
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Protected routes (Admin only)
router.post('/', verifyToken, requireRole(['admin', 'seller']), createCategory);
router.put('/:id', verifyToken, requireRole(['admin', 'seller']), updateCategory);
router.delete('/:id', verifyToken, requireRole(['admin', 'seller']), deleteCategory);

module.exports = router;