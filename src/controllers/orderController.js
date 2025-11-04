const Order = require("../models/Order");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const payOSService = require("../services/payosService");

// ==================== TẠO ORDER ====================
exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      returnUrl,
      cancelUrl,
    } = req.body;

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Giỏ hàng trống" });
    }

    // 1️⃣ Kiểm tra tồn kho trước khi tạo order
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product)
        return res
          .status(404)
          .json({
            success: false,
            message: `Sản phẩm ${item.name} không tồn tại`,
          });

      let variantStock = null;
      if (item.variant && product.variants && product.variants.length > 0) {
        const v = product.variants.find(
          (v) => v._id.toString() === item.variant._id.toString()
        );
        if (v) variantStock = v.countInStock;
      }

      if (
        (variantStock !== null && variantStock < item.quantity) ||
        (variantStock === null && product.countInStock < item.quantity)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Sản phẩm ${product.name} không đủ số lượng`,
          });
      }
    }

    // 2️⃣ Áp dụng giảm giá
    let discountAmount = 0;
    let adjustedItemsPrice = itemsPrice;
    const previousOrders = await Order.find({ userId: req.user.id });
    if (previousOrders.length > 0 && items.length >= 3) {
      discountAmount = adjustedItemsPrice * 0.1;
      adjustedItemsPrice -= discountAmount;
    }
    const finalTotalPrice = adjustedItemsPrice + taxPrice + shippingPrice;

    // 3️⃣ Tạo order
    const order = await Order.create({
      userId: req.user.id,
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice: adjustedItemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice: finalTotalPrice,
      discountAmount,
      discountApplied: discountAmount > 0,
    });

    // 4️⃣ Nếu COD: trừ kho ngay
    if (paymentMethod === "COD") {
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        let variantData = null;
        if (item.variant && product.variants && product.variants.length > 0) {
          const vIndex = product.variants.findIndex(
            (v) => v._id.toString() === item.variant._id.toString()
          );
          if (vIndex >= 0) {
            product.variants[vIndex].countInStock -= item.quantity;
            variantData = { ...product.variants[vIndex].toObject() };
          }
        }

        // Cập nhật tổng countInStock của product
        product.countInStock = product.variants.reduce(
          (sum, v) => sum + (v.countInStock || 0),
          0
        );
        await product.save();

        await Inventory.create({
          productId: item.productId,
          variant: variantData,
          type: "export",
          quantity: item.quantity,
          note: "Bán hàng - COD",
          stockAfter: variantData
            ? variantData.countInStock
            : product.countInStock,
          orderId: order._id,
        });
      }
    }

    // 5️⃣ Nếu Online Payment → tạo link PayOS
    let response = {
      success: true,
      message:
        discountAmount > 0
          ? "Đặt hàng thành công — Voucher 10% đã được áp dụng!"
          : "Đặt hàng thành công",
      data: await Order.findById(order._id)
        .populate("userId", "name email")
        .populate("items.productId", "name image"),
      discountApplied: discountAmount > 0,
      discountAmount,
    };

    if (paymentMethod === "PayOS") {
      try {
        const payOSItems = items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: Math.round(i.price),
        }));
        const shortDesc = `Thanh toán DH #${order._id.toString().slice(-6)}`;
        const paymentData = {
          orderId: order._id.toString(),
          amount: Math.round(finalTotalPrice),
          description: shortDesc,
          buyerName: shippingAddress.fullName,
          buyerEmail: req.user.email,
          buyerPhone: shippingAddress.phone,
          buyerAddress: `${shippingAddress.address}, ${shippingAddress.city}`,
          items: payOSItems,
          returnUrl: returnUrl || `${process.env.FRONTEND_URL}/order-success`,
          cancelUrl: cancelUrl || `${process.env.FRONTEND_URL}/order-failure`,
        };
        const paymentResult = await payOSService.createPaymentLink(paymentData);
        response.payOS = {
          checkoutUrl: paymentResult.data.checkoutUrl,
          qrCode: paymentResult.data.qrCode,
          orderCode: paymentResult.orderCode,
        };
      } catch (err) {
        console.error("❌ Lỗi PayOS:", err);
        await Order.findByIdAndDelete(order._id);
        return res
          .status(500)
          .json({
            success: false,
            message: `Tạo payment link thất bại: ${err.message}`,
          });
      }
    }

    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ==================== CẬP NHẬT THANH TOÁN ONLINE ====================
exports.updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    if (order.paymentMethod === "COD") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Đơn hàng COD không cần update thanh toán",
        });
    }

    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.email_address,
    };
    await order.save();

    // Trừ kho cho từng item
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      let variantData = null;
      if (item.variant && product.variants && product.variants.length > 0) {
        const vIndex = product.variants.findIndex(
          (v) => v._id.toString() === item.variant._id.toString()
        );
        if (vIndex >= 0) {
          product.variants[vIndex].countInStock -= item.quantity;
          variantData = { ...product.variants[vIndex].toObject() };
        }
      }

      // Cập nhật tổng countInStock của product từ tất cả variants
      product.countInStock = product.variants.reduce(
        (sum, v) => sum + (v.countInStock || 0),
        0
      );
      await product.save();

      await Inventory.create({
        productId: item.productId,
        variant: variantData,
        type: "export",
        quantity: item.quantity,
        note: "Bán hàng - thanh toán online",
        stockAfter: variantData
          ? variantData.countInStock
          : product.countInStock,
        orderId: order._id,
      });
    }

    const populatedOrder = await Order.findById(order._id)
      .populate("userId", "name email")
      .populate("items.productId", "name image");

    res
      .status(200)
      .json({
        success: true,
        message: "Thanh toán thành công và cập nhật kho",
        data: populatedOrder,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CẬP NHẬT TRẠNG THÁI ====================
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];
    if (!validStatuses.includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ" });

    const updateData = { status };
    if (status === "Delivered") {
      updateData.isDelivered = true;
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate("userId", "name email")
      .populate("items.productId", "name image");

    res
      .status(200)
      .json({
        success: true,
        message: "Cập nhật trạng thái thành công",
        data: updatedOrder,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LẤY ORDER THEO ID ====================
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("userId", "name email")
      .populate("items.productId", "name image price");
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    if (
      order.userId._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Bạn không có quyền xem đơn hàng này",
        });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LẤY ĐƠN HÀNG USER HIỆN TẠI ====================
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("items.productId", "name image")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LẤY TẤT CẢ ORDER (ADMIN) ====================
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const orders = await Order.find(filter)
      .populate("userId", "name email")
      .populate("items.productId", "name image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Order.countDocuments(filter);

    res
      .status(200)
      .json({
        success: true,
        data: orders,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== HỦY ORDER ====================
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    if (order.userId.toString() !== req.user.id)
      return res
        .status(403)
        .json({
          success: false,
          message: "Bạn không có quyền hủy đơn hàng này",
        });
    if (order.status !== "Pending")
      return res
        .status(400)
        .json({
          success: false,
          message: "Không thể hủy đơn hàng đã được xử lý",
        });

    for (let item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      if (item.variant && product.variants && product.variants.length > 0) {
        const vIndex = product.variants.findIndex(
          (v) => v._id.toString() === item.variant._id.toString()
        );
        if (vIndex >= 0) product.variants[vIndex].countInStock += item.quantity;
      } else {
        product.countInStock += item.quantity;
      }
      await product.save();
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Cancelled" },
      { new: true }
    );
    res
      .status(200)
      .json({
        success: true,
        message: "Hủy đơn hàng thành công",
        data: updatedOrder,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
