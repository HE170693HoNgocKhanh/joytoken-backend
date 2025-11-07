// routes/inventoryRoutes.js
const express = require("express");
const {
  importStock,
  exportStock,
  getInventoryHistory,
  getStockList,
  getLowStockAlert,
  productHistory,
} = require("../controllers/inventoryController");

const { verifyToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// =====================
// 🔐 Protected routes (chỉ admin hoặc staff)
// =====================

// Nhập kho
router.post(
  "/import",
  verifyToken,
  requireRole(["admin", "staff"]),
  importStock
);

// Xuất kho
router.post(
  "/export",
  verifyToken,
  requireRole(["admin", "staff"]),
  exportStock
);

// Lịch sử nhập/xuất kho
router.get(
  "/history",
  verifyToken,
  requireRole(["admin", "staff"]),
  getInventoryHistory
);

// Tồn kho hiện tại
router.get(
  "/stock",
  verifyToken,
  requireRole(["admin", "staff"]),
  getStockList
);

// Cảnh báo tồn kho thấp
router.get(
  "/low-stock",
  verifyToken,
  requireRole(["admin", "staff"]),
  getLowStockAlert
);

router.get(
  "/product-history/:productId",
  verifyToken,
  requireRole(["admin", "staff"]),
  productHistory
);

module.exports = router;
