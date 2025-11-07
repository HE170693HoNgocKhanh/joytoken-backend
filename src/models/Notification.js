const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index để query nhanh hơn
    },
    type: {
      type: String,
      enum: [
        "exchange_approved",
        "exchange_rejected",
        "order_status",
        "order_delivered",
        "order_cancelled",
        "system",
        "promotion",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: {
      type: String, // URL để navigate khi click vào thông báo
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed, // Lưu thêm data như orderId, exchangeId, etc.
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh hơn
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;

