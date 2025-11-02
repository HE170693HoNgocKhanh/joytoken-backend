const Conversation = require("../models/Conversation");

exports.getAllConversationsByUser = async (req, res) => {
  try {
    const userId = req.user.id; // middleware auth gắn vào req.user

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate({
        path: "participants",
        select: "name email", // chỉ lấy trường cần thiết
      })
      .populate({
        path: "lastMessage",
        select: "content sender createdAt",
        populate: { path: "sender", select: "name avatar" },
      })
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required",
      });
    }

    // Kiểm tra xem cuộc trò chuyện giữa hai người này đã tồn tại chưa
    let existingConversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
    });

    if (existingConversation) {
      return res.status(200).json({
        success: true,
        message: "Conversation already exists",
        data: existingConversation,
      });
    }

    // Nếu chưa có -> tạo mới
    const newConversation = await Conversation.create({
      participants: [senderId, receiverId],
    });

    res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      data: newConversation,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
