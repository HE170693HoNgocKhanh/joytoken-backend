const express = require("express");
const authRoutes = require("./authRoutes");
const categoryRoutes = require("./categoryRoutes");
const productRoutes = require("./productRoutes");
const orderRoutes = require("./orderRoutes");
const reviewRoutes = require("./reviewRoutes");
const userRoutes = require("./userRoutes");
const conversationRoutes = require("./conversationRoutes");
const chatBotRoutes = require("./chatBotRoutes");
const inventoryRoutes = require("./inventoryRoutes");
const exchangeRoutes = require("./exchangeRoutes");
const notificationRoutes = require("./notificationRoutes");
const trackingRoutes = require("./trackingRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/reviews", reviewRoutes);
router.use("/users", userRoutes);
router.use("/conversations", conversationRoutes);
router.use("/chatbot", chatBotRoutes);
router.use("/inventories", inventoryRoutes);
router.use("/exchanges", exchangeRoutes);
router.use("/notifications", notificationRoutes);
router.use("/tracking", trackingRoutes);

module.exports = router;
