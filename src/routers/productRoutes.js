const express = require("express");
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBySeller,
  getProductsWithOrderValues,
} = require("../controllers/productController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload"); // 👈 thêm middleware upload
const {
  createProductValidator,
  updateProductValidator,
  productIdParamValidator,
  sellerIdParamValidator,
} = require("../validators/productValidators");

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
router.get("/seller/:sellerId", sellerIdParamValidator, getProductsBySeller);

// =====================
// 🌍 Public routes
// =====================
router.get("/", getAllProducts);
router.get("/featured/order-values", getProductsWithOrderValues); // ✅ Endpoint mới cho homepage
router.get("/:id", productIdParamValidator, getProductById);

// =====================
// 🔐 Protected routes
// =====================
router.post(
  "/",
  verifyToken,
  requireRole(["seller", "admin", "staff"]),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 3 },
  ]),
  createProductValidator,
  createProduct
);

router.put(
  "/:id",
  verifyToken,
  requireRole(["seller", "admin"]),
  productIdParamValidator,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 3 },
  ]),
  updateProductValidator,
  updateProduct
);

router.delete(
  "/:id",
  verifyToken,
  requireRole(["seller", "admin"]),
  productIdParamValidator,
  deleteProduct
);

module.exports = router;
