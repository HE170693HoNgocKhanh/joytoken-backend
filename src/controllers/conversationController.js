const Conversation = require("../models/Conversation");
const User = require("../models/User");

exports.getAllConversationsByUser = async (req, res) => {
  try {
    const userId = req.user.id; // middleware auth gắn vào req.user

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate({
        path: "participants",
        select: "name email role", // thêm role để hiển thị
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

    // Lấy thông tin user hiện tại để kiểm tra role
    const sender = await User.findById(senderId).select("role");
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let finalReceiverId = receiverId;

    // Nếu user là customer và không có receiverId → tự động tìm seller
    if (sender.role === "customer" && !receiverId) {
      const seller = await User.findOne({ role: "seller" }).select("_id");
      if (!seller) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy seller để chat",
        });
      }
      finalReceiverId = seller._id.toString();
    }
    // Nếu user là admin/staff/seller và không có receiverId → yêu cầu receiverId
    else if (["admin", "staff", "seller"].includes(sender.role) && !receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required for admin/staff/seller",
      });
    }

    // Kiểm tra xem cuộc trò chuyện giữa hai người này đã tồn tại chưa
    let existingConversation = await Conversation.findOne({
      participants: { $all: [senderId, finalReceiverId], $size: 2 },
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
      participants: [senderId, finalReceiverId],
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
