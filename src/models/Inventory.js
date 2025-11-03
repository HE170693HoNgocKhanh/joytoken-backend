const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  variant: {
    // theo variant của sản phẩm
    _id: { type: mongoose.Schema.Types.ObjectId },
    size: String,
    color: String,
  },
  type: { type: String, enum: ["import", "export"], required: true },
  quantity: { type: Number, required: true, min: 1 },
  note: { type: String }, // lý do nhập/xuất, mặc định export = "Bán hàng"
  date: { type: Date, default: Date.now },
  stockAfter: { type: Number, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
});

module.exports = mongoose.model("Inventory", inventorySchema);
