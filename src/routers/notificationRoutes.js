const express = require("express");
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Protected routes - User
router.get("/", verifyToken, getUserNotifications);
router.get("/unread-count", verifyToken, getUnreadCount);
router.put("/:id/read", verifyToken, markAsRead);
router.put("/read-all", verifyToken, markAllAsRead);
router.delete("/:id", verifyToken, deleteNotification);

module.exports = router;

