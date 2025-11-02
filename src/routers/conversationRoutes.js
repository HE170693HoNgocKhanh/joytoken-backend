const express = require("express");
const {
  getAllConversationsByUser,
  createConversation,
} = require("../controller/conversationController");
const { getConversationDetail } = require("../controller/messageController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, getAllConversationsByUser);
router.get("/:id", verifyToken, getConversationDetail);
router.post("/", verifyToken, createConversation);

module.exports = router;
