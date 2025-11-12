const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

exports.getConversationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    // ✅ Kiểm tra conversation tồn tại
    const conversation = await Conversation.findById(id).populate(
      "participants",
      "name email role avatar"
    ); // lấy thêm role và avatar để hiển thị đầy đủ
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // ✅ Lấy danh sách tin nhắn theo conversationId
    const messages = await Message.find({ conversationId: id })
      .populate("sender", "name email role avatar") // lấy đầy đủ thông tin người gửi
      .sort({ createdAt: 1 }); // sắp xếp theo thời gian tăng dần

    res.status(200).json({
      success: true,
      data: {
        conversation,
        messages,
      },
    });
  } catch (error) {
    console.error("Error fetching conversation detail:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  return res.json({
    message: "Upload successful",
    imageUrl: req.file.path, // Cloudinary auto returns secure url
  });
};
