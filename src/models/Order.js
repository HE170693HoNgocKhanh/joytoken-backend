const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
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
          stock: Number,
          countInStock: Number,
        },
        personalization: String,
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["COD", "Credit Card", "PayPal", "Bank Transfer", "PayOS"],
    },
    paymentResult: {
      transactionId: String,
      provider: String, // PayPal | Stripe | Momo | PayOS
      status: String,
      paidAt: Date,
      email: String,
      payOSData: {
        orderCode: { type: Number, unique: true, sparse: true }, // ✅ Unique để tránh duplicate orders
        paymentLinkId: String,
        checkoutUrl: String,
        qrCode: String,
      },
    },
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },

    // ✅ Voucher fields mới thêm
    discountApplied: {
      type: Boolean,
      default: false,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },

    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    isDelivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: Date,
    cancelReason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);

// ✅ Tạo unique index trên payOSOrderCode để đảm bảo không có duplicate orders
// Index này sẽ được tạo tự động khi model được load lần đầu
Order.collection.createIndex(
  { "paymentResult.payOSData.orderCode": 1 },
  { unique: true, sparse: true, background: true },
  (err) => {
    if (err && err.code !== 85) { // 85 = IndexOptionsConflict
      console.warn("⚠️ Warning creating unique index on payOSOrderCode:", err.message);
    } else {
      console.log("✅ Unique index on payOSOrderCode created/verified");
    }
  }
);

module.exports = Order;
