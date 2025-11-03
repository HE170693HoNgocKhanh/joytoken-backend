const { default: mongoose } = require("mongoose");
const Inventory = require("../models/Inventory");
const Order = require("../models/Order");
const Product = require("../models/Product");

// --- 1. Nhập kho ---
// controllers/inventoryController.js
exports.importStock = async (req, res) => {
  try {
    const { productId, variantId, quantity, note } = req.body;

    if (!productId || !quantity)
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });

    // ✅ Tìm sản phẩm
    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });

    let stockAfter = 0;
    let variantInfo = null;

    // ✅ Nếu có variant → cập nhật đúng variant đó
    if (variantId) {
      const variantIndex = product.variants.findIndex(
        (v) => v._id.toString() === variantId
      );

      if (variantIndex === -1)
        return res
          .status(404)
          .json({ message: "Không tìm thấy phiên bản sản phẩm" });

      // Cập nhật tồn kho của variant
      product.variants[variantIndex].countInStock += quantity;
      stockAfter = product.variants[variantIndex].countInStock;

      // Lưu thông tin variant vào log
      variantInfo = {
        _id: product.variants[variantIndex]._id,
        size: product.variants[variantIndex].size,
        color: product.variants[variantIndex].color,
      };
    }

    // ✅ Cập nhật tổng tồn kho sản phẩm
    product.countInStock += quantity;

    // Lưu thay đổi vào DB
    await product.save();

    // ✅ Ghi lịch sử kho
    const inventory = new Inventory({
      productId,
      variant: variantInfo,
      type: "import",
      quantity,
      note,
      stockAfter,
    });

    await inventory.save();

    res.status(201).json({
      message: "Nhập kho thành công",
      inventory,
      updatedStock: {
        productStock: product.countInStock,
        variantStock: stockAfter || null,
      },
    });
  } catch (err) {
    console.error("❌ Import stock error:", err);
    res.status(500).json({ message: err.message });
  }
};

// --- 2. Xuất kho ---
// controllers/inventoryController.js
exports.exportStock = async (req, res) => {
  try {
    const { productId, variantId, quantity, note } = req.body;

    if (!productId || !quantity)
      return res.status(400).json({ message: "Thiếu dữ liệu" });

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });

    let stockAfter;
    let variantInfo = null;

    // ✅ Nếu có variantId => trừ kho variant
    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant)
        return res.status(404).json({ message: "Biến thể không tồn tại" });

      if (variant.countInStock < quantity)
        return res
          .status(400)
          .json({ message: "Số lượng tồn kho của biến thể không đủ" });

      variant.countInStock -= quantity;
      await product.save();

      // ✅ Cập nhật tồn kho tổng
      product.countInStock = product.variants.reduce(
        (sum, v) => sum + v.countInStock,
        0
      );
      await product.save();

      stockAfter = variant.countInStock;

      // Chuẩn hóa thông tin variant để ghi log inventory
      variantInfo = {
        _id: variant._id,
        size: variant.size,
        color: variant.color,
      };
    } else {
      // ✅ Không có variant => trừ kho tổng
      if (product.countInStock < quantity)
        return res.status(400).json({ message: "Số lượng tồn kho không đủ" });

      product.countInStock -= quantity;
      await product.save();

      stockAfter = product.countInStock;
    }

    // ✅ Lưu Inventory với thông tin variant chi tiết (nếu có)
    const inventory = new Inventory({
      productId,
      variant: variantInfo,
      type: "export",
      quantity,
      note,
      stockAfter,
    });
    await inventory.save();

    res.status(201).json({
      message: "Xuất kho thành công",
      inventory,
    });
  } catch (err) {
    console.error("Export Stock Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// --- 3. Xem tất cả lịch sử kho ---
exports.getInventoryHistory = async (req, res) => {
  try {
    const inventories = await Inventory.find()
      .populate("productId", "name")
      .sort({ date: -1 });
    res.json(inventories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 4. Xem tồn kho hiện tại ---
exports.getStockList = async (req, res) => {
  try {
    const products = await Product.find().select("name countInStock minStock");
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- 5. Kiểm tra cảnh báo tồn kho thấp ---
exports.getLowStockAlert = async (req, res) => {
  try {
    // Giả sử Product có field minStock
    const lowStockProducts = await Product.find({
      stockQuantity: { $lte: "$minStock" },
    });
    res.json(lowStockProducts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.productHistory = async (req, res) => {
  try {
    const { productId } = req.params;

    // Lấy product info để phân tích variants
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Lấy tất cả lịch sử inventory của product, sắp xếp theo date mới -> cũ
    const history = await Inventory.find({ productId })
      .sort({ date: -1 })
      .lean();

    // Build kết quả, bổ sung orderInfo nếu export
    const results = await Promise.all(
      history.map(async (record) => {
        let orderInfo = null;

        // Nếu export và có orderId, lấy thông tin đơn hàng
        if (record.type === "export" && record.orderId) {
          const order = await Order.findById(record.orderId).lean();
          if (order) {
            const item = order.items.find(
              (i) =>
                i.productId.toString() === productId &&
                (!record.variant ||
                  (i.variant &&
                    i.variant._id.toString() === record.variant._id.toString()))
            );

            if (item) {
              orderInfo = {
                orderId: order._id,
                customerName: order.shippingAddress.fullName,
                address: order.shippingAddress.address,
                phone: order.shippingAddress.phone,
                status: order.status,
                variant: item.variant,
                quantityOrdered: item.quantity,
              };
            }
          }
        }

        // Nếu export mà không có orderId, mặc định note = "Bán hàng"
        if (record.type === "export" && !record.note) {
          record.note = "Bán hàng";
        }

        return { ...record, orderInfo };
      })
    );

    // Nếu muốn, có thể bổ sung tổng số lượng product = sum quantity của tất cả variant
    const totalStock =
      product.variants?.reduce((acc, v) => {
        const lastStock =
          results
            .filter((r) => r.variant?._id?.toString() === v._id.toString())
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
            ?.stockAfter || 0;
        return acc + lastStock;
      }, 0) || 0;

    res.json({ totalStock, history: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi lấy lịch sử kho" });
  }
};
