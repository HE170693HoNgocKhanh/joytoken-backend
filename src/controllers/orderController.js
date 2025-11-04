const Order = require("../models/Order");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const payOSService = require("../services/payosService");
// ==================== TẠO ORDER MỚI ====================
exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      returnUrl,
      cancelUrl,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Giỏ hàng trống",
      });
    }

    // ✅ Kiểm tra tồn kho từng sản phẩm
    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Sản phẩm ${item.name} không tồn tại`,
        });
      }

      if (product.countInStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ${product.name} không đủ số lượng trong kho`,
        });
      }
    }

    // ✅ TÍNH LẠI GIÁ TRỊ VÀ ÁP DỤNG GIẢM GIÁ (nếu đủ điều kiện)
    let adjustedItemsPrice = itemsPrice;
    let discountAmount = 0;

    // Lấy tất cả đơn hàng cũ của user
    const previousOrders = await Order.find({ userId: req.user.id });

    // Nếu khách đã từng mua và lần này mua ≥ 3 sản phẩm
    if (previousOrders.length > 0 && items.length >= 3) {
      discountAmount = adjustedItemsPrice * 0.1; // giảm 10%
      adjustedItemsPrice = adjustedItemsPrice - discountAmount;
    }

    const finalTotalPrice = adjustedItemsPrice + taxPrice + shippingPrice;

    // ✅ Tạo order mới
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

    // ✅ Cập nhật tồn kho
    for (let item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { countInStock: -item.quantity },
      });
    }

    // ✅ Populate dữ liệu để trả về frontend
    const populatedOrder = await Order.findById(order._id)
      .populate("userId", "name email")
      .populate("items.productId", "name image");

    let response = {
      success: true,
      message:
        discountAmount > 0
          ? "Đặt hàng thành công — Voucher 10% đã được áp dụng!"
          : "Đặt hàng thành công",
      data: populatedOrder,
      discountApplied: discountAmount > 0,
      discountAmount,
    };

    // ✅ Nếu payment method là PayOS, tạo payment link
    if (paymentMethod === "PayOS") {
      try {
        const payOSItems = items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: Math.round(item.price),
        }));

        const paymentData = {
          orderId: order._id.toString(),
          amount: Math.round(finalTotalPrice),
          description: `Thanh toán đơn hàng #${order._id}`,
          buyerName: shippingAddress.fullName,
          buyerEmail: req.user.email,
          buyerPhone: shippingAddress.phone,
          buyerAddress: `${shippingAddress.address}, ${shippingAddress.city}`,
          items: payOSItems,
          returnUrl: returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
          cancelUrl: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        };

        const paymentResult = await payOSService.createPaymentLink(paymentData);

        response.payOS = {
          checkoutUrl: paymentResult.data.checkoutUrl,
          qrCode: paymentResult.data.qrCode,
          orderCode: paymentResult.orderCode,
        };
      } catch (payOSError) {
        // Nếu tạo PayOS thất bại, hoàn lại tồn kho
        for (let item of items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { countInStock: item.quantity },
          });
        }

        // Xóa order
        await Order.findByIdAndDelete(order._id);

        return res.status(500).json({
          success: false,
          message: `Tạo payment link thất bại: ${payOSError.message}`,
        });
      }
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("❌ Lỗi tạo đơn hàng:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== CÁC HÀM KHÁC GIỮ NGUYÊN ====================

// Lấy tất cả orders (cho admin)
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const orders = await Order.find(filter)
      .populate("userId", "name email")
      .populate("items.productId", "name image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy orders của user hiện tại
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("items.productId", "name image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy order theo ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("userId", "name email")
      .populate("items.productId", "name image price");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    if (
      order.userId._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem đơn hàng này",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật trạng thái order
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

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

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

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái đơn hàng thành công",
      data: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật thanh toán

exports.updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    // ✅ Cập nhật trạng thái thanh toán
    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.email_address,
    };
    await order.save();

    // ✅ Tạo entry export trong Inventory và cập nhật tồn kho variant (nếu có)
    for (let item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      let stockAfter = product.countInStock; // mặc định dùng tổng nếu không có variant
      let variantData = null;

      if (product.variants && product.variants.length > 0) {
        const rawVariantId =
          (item.variant && (item.variant._id || item.variant.id)) ||
          item.variantId ||
          item.selectedVariantId ||
          (typeof item.variant === "string" ? item.variant : null);

        let variantIndex = -1;
        if (rawVariantId) {
          const variantIdStr = rawVariantId.toString();
          variantIndex = product.variants.findIndex(
            (v) => v._id.toString() === variantIdStr
          );
        }

        if (variantIndex === -1 && product.variants.length === 1) {
          variantIndex = 0;
        }

        if (variantIndex >= 0) {
          const currentVariantStock =
            product.variants[variantIndex].countInStock || 0;
          const remaining = Math.max(0, currentVariantStock - item.quantity);
          product.variants[variantIndex].countInStock = remaining;
          stockAfter = remaining;

          variantData = {
            _id: product.variants[variantIndex]._id,
            size: product.variants[variantIndex].size,
            color: product.variants[variantIndex].color,
          };

          await product.save();
        }
      }

      // LƯU Ý: Không trừ tiếp tổng countInStock tại đây để tránh trừ 2 lần
      // (đã trừ khi tạo order). Chỉ ghi nhận lịch sử kho.

      await Inventory.create({
        productId: item.productId,
        variant: variantData,
        type: "export",
        quantity: item.quantity,
        note: "Bán hàng - thanh toán thành công",
        stockAfter,
        orderId: order._id,
      });
    }

    const populatedOrder = await Order.findById(order._id)
      .populate("userId", "name email")
      .populate("items.productId", "name image");

    res.status(200).json({
      success: true,
      message: "Cập nhật thanh toán thành công và tạo entry kho",
      data: populatedOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Hủy order
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy đơn hàng này",
      });
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Không thể hủy đơn hàng đã được xử lý",
      });
    }

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { countInStock: item.quantity },
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Cancelled" },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Hủy đơn hàng thành công",
      data: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
