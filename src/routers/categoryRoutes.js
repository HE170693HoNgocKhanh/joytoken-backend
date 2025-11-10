const express = require('express');
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const {
  createCategoryValidator,
  updateCategoryValidator,
  categoryIdParamValidator
} = require('../validators/categoryValidators');

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', categoryIdParamValidator, getCategoryById);

// Protected routes (Admin only)
router.post('/', verifyToken, requireRole(['admin', 'seller']), createCategoryValidator, createCategory);
router.put('/:id', verifyToken, requireRole(['admin', 'seller']), categoryIdParamValidator, updateCategoryValidator, updateCategory);
router.delete('/:id', verifyToken, requireRole(['admin', 'seller']), categoryIdParamValidator, deleteCategory);

module.exports = router;