const express = require('express');
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controller/categoryController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Protected routes (Admin only)
router.post('/', verifyToken, requireRole(['admin']), createCategory);
router.put('/:id', verifyToken, requireRole(['admin']), updateCategory);
router.delete('/:id', verifyToken, requireRole(['admin']), deleteCategory);

module.exports = router;