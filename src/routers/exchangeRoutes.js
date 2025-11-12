const express = require("express");
const {
  createExchange,
  getMyExchanges,
  getExchangeById,
  getAllExchanges,
  updateExchangeStatus,
  cancelExchange,
  processExchangePayment,
} = require("../controllers/exchangeController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const {
  createExchangeValidator,
  updateExchangeStatusValidator,
  exchangeIdParamValidator,
} = require("../validators/exchangeValidators");

const router = express.Router();

// Protected routes - Customer
router.post("/", verifyToken, createExchangeValidator, createExchange);
router.get("/my-exchanges", verifyToken, getMyExchanges);
router.get("/:id", verifyToken, exchangeIdParamValidator, getExchangeById);
router.put("/:id/cancel", verifyToken, exchangeIdParamValidator, cancelExchange);
router.put("/:exchangeId/payment", verifyToken, processExchangePayment);

// Protected routes - Admin/Staff/Seller
router.get("/", verifyToken, requireRole(["admin", "seller"]), getAllExchanges);
router.put(
  "/:id/status",
  verifyToken,
  requireRole(["admin", "seller"]),
  exchangeIdParamValidator,
  updateExchangeStatusValidator,
  updateExchangeStatus
);

module.exports = router;

