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
const {
  createOrderValidator,
  orderIdParamValidator,
  statusUpdateValidator,
} = require('../validators/orderValidators');

const router = express.Router();

// Protected routes - Customer
router.post('/', verifyToken, createOrderValidator, createOrder);
router.get('/my-orders', verifyToken, getMyOrders);
router.get('/:id', verifyToken, orderIdParamValidator, getOrderById);
router.put('/:id/cancel', verifyToken, orderIdParamValidator, cancelOrder);
router.put('/:id/pay', verifyToken, orderIdParamValidator, updateOrderToPaid);

// Protected routes - Admin/Staff
router.get('/', verifyToken, requireRole(['admin', 'staff, seller']), getAllOrders);
router.put('/:id/status', verifyToken, requireRole(['admin', 'staff']), orderIdParamValidator, statusUpdateValidator, updateOrderStatus);



module.exports = router;