const mongoose = require("mongoose");

const pendingOrderSchema = new mongoose.Schema(
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
    discountApplied: {
      type: Boolean,
      default: false,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    payOSOrderCode: {
      type: Number,
      required: true,
      unique: true,
    },
    payOSPaymentLinkId: String,
    payOSCheckoutUrl: String,
    payOSQrCode: String,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 phút
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  }
);

const PendingOrder = mongoose.model("PendingOrder", pendingOrderSchema);
module.exports = PendingOrder;

