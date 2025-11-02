const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const mongoose = require("mongoose");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`🟡 ${socket.id} joined conversation ${conversationId}`);
    });

    // 💬 Khi user gửi tin nhắn mới
    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, senderId, content, type } = data;

        // Lưu tin nhắn vào DB
        const newMessage = await Message.create({
          conversationId,
          sender: new mongoose.Types.ObjectId(senderId),
          content,
          type,
        });

        // Cập nhật lastMessage cho conversation
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: newMessage._id,
          updatedAt: Date.now(),
        });

        // Lấy message đầy đủ để gửi lại cho frontend
        const populatedMsg = await Message.findById(newMessage._id)
          .populate("sender", "name email")
          .lean();

        // Gửi message realtime đến tất cả user trong room
        io.to(conversationId).emit("receiveMessage", populatedMsg);
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });
    // 🖼️ Khi user gửi tin nhắn dạng ảnh
    socket.on("sendImageMessage", async (data) => {
      try {
        const { conversationId, senderId, imageUrl } = data;

        const newMessage = await Message.create({
          conversationId,
          sender: new mongoose.Types.ObjectId(senderId),
          content: imageUrl,
          type: "image",
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: newMessage._id,
          updatedAt: Date.now(),
        });

        const populatedMsg = await Message.findById(newMessage._id)
          .populate("sender", "name email")
          .lean();

        io.to(conversationId).emit("receiveMessage", populatedMsg);
      } catch (error) {
        console.error("Error sending image message:", error);
      }
    });
  });
};
