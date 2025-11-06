const Notification = require("../models/Notification");

// ==================== TẠO THÔNG BÁO ====================
exports.createNotification = async (userId, type, title, message, link = null, metadata = {}) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      link,
      metadata,
    });
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// ==================== LẤY THÔNG BÁO CỦA USER ====================
exports.getUserNotifications = async (req, res) => {
  try {
    const { limit = 20, unreadOnly = false } = req.query;
    const filter = { userId: req.user.id };
    
    if (unreadOnly === "true") {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ĐÁNH DẤU ĐÃ ĐỌC ====================
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    // Kiểm tra quyền sở hữu
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền đánh dấu thông báo này",
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Đã đánh dấu đã đọc",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ĐÁNH DẤU TẤT CẢ ĐÃ ĐỌC ====================
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== XÓA THÔNG BÁO ====================
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    // Kiểm tra quyền sở hữu
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa thông báo này",
      });
    }

    await Notification.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Đã xóa thông báo",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== LẤY SỐ LƯỢNG THÔNG BÁO CHƯA ĐỌC ====================
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

