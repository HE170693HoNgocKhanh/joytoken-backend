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
          name: String,
          image: String,
          price: Number,
          stock: Number,
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
      enum: ["COD", "Credit Card", "PayPal", "Bank Transfer"],
    },
    paymentResult: {
      transactionId: String,
      provider: String, // PayPal | Stripe | Momo
      status: String,
      paidAt: Date,
      email: String,
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
module.exports = Order;
