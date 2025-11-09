const express = require("express");
const {
  createExchange,
  getMyExchanges,
  getExchangeById,
  getAllExchanges,
  updateExchangeStatus,
  cancelExchange,
} = require("../controllers/exchangeController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Protected routes - Customer
router.post("/", verifyToken, createExchange);
router.get("/my-exchanges", verifyToken, getMyExchanges);
router.get("/:id", verifyToken, getExchangeById);
router.put("/:id/cancel", verifyToken, cancelExchange);

// Protected routes - Admin/Staff/Seller
router.get("/", verifyToken, requireRole(["admin", "seller"]), getAllExchanges);
router.put(
  "/:id/status",
  verifyToken,
  requireRole(["admin", "seller"]),
  updateExchangeStatus
);

module.exports = router;

