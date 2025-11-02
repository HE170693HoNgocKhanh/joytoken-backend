const express = require("express");
const {
  getAllConversationsByUser,
  createConversation,
} = require("../controllers/conversationController");
const {
  getConversationDetail,
  uploadImage,
} = require("../controllers/messageController");
const { verifyToken } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/", verifyToken, getAllConversationsByUser);
router.get("/:id", verifyToken, getConversationDetail);
router.post("/", verifyToken, createConversation);
router.post("/upload/image", verifyToken, upload.single("image"), uploadImage);

module.exports = router;
