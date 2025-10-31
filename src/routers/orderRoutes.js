const express = require('express');
const {
  createOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderToPaid,
  cancelOrder
} = require('../controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Protected routes - Customer
router.post('/', verifyToken, createOrder);
router.get('/my-orders', verifyToken, getMyOrders);
router.get('/:id', verifyToken, getOrderById);
router.put('/:id/cancel', verifyToken, cancelOrder);
router.put('/:id/pay', verifyToken, updateOrderToPaid);

// Protected routes - Admin/Staff
router.get('/', verifyToken, requireRole(['admin', 'staff']), getAllOrders);
router.put('/:id/status', verifyToken, requireRole(['admin', 'staff']), updateOrderStatus);

module.exports = router;