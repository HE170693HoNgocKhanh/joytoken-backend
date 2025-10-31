const express = require("express");
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBySeller,
} = require("../controllers/productController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload"); // 👈 thêm middleware upload

const router = express.Router();

// =====================
// 🏷️ Seller routes (đặt TRƯỚC để tránh xung đột với "/:id")
// =====================
router.get(
  "/seller/my-products",
  verifyToken,
  requireRole(["seller", "admin"]),
  getProductsBySeller
);
router.get("/seller/:sellerId", getProductsBySeller);

// =====================
// 🌍 Public routes
// =====================
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// =====================
// 🔐 Protected routes
// =====================
router.post(
  "/",
  verifyToken,
  requireRole(["seller", "admin"]),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 3 },
  ]),
  createProduct
);

router.put(
  "/:id",
  verifyToken,
  requireRole(["seller", "admin"]),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 3 },
  ]),
  updateProduct
);

router.delete(
  "/:id",
  verifyToken,
  requireRole(["seller", "admin"]),
  deleteProduct
);

module.exports = router;
