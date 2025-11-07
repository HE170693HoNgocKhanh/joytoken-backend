const mongoose = require("mongoose");

const exchangeSchema = new mongoose.Schema(
  {
    originalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Sản phẩm muốn trả (từ đơn cũ)
    itemsToReturn: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        image: String,
        variant: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
          size: String,
          color: String,
          name: String,
          image: String,
          price: Number,
        },
      },
    ],
    // Sản phẩm muốn đổi (mới)
    itemsToExchange: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        image: String,
        variant: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
          size: String,
          color: String,
          name: String,
          image: String,
          price: Number,
        },
      },
    ],
    // Lý do đổi hàng
    reason: {
      type: String,
      required: true,
    },
    // Trạng thái: Pending (chờ seller xử lý), Approved (seller đồng ý), Rejected (seller từ chối), Completed (hoàn tất)
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed", "Cancelled"],
      default: "Pending",
    },
    // Ghi chú của seller/admin
    adminNotes: {
      type: String,
      default: "",
    },
    // Đơn hàng mới được tạo khi seller approve
    newOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    // Thông tin giao hàng (lấy từ đơn cũ)
    shippingAddress: {
      fullName: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true },
    },
    // Phương thức thanh toán
    paymentMethod: {
      type: String,
      enum: ["COD", "Credit Card", "PayPal", "Bank Transfer", "PayOS"],
      default: "COD",
    },
  },
  {
    timestamps: true,
  }
);

const Exchange = mongoose.model("Exchange", exchangeSchema);
module.exports = Exchange;

