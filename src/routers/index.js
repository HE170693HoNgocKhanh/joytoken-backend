const express = require("express");
const authRoutes = require("./authRoutes");
const categoryRoutes = require("./categoryRoutes");
const productRoutes = require("./productRoutes");
const orderRoutes = require("./orderRoutes");
const reviewRoutes = require("./reviewRoutes");
const conversationRoutes = require("./conversationRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/reviews", reviewRoutes);
router.use("/conversations", conversationRoutes);

module.exports = router;
