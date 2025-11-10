const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const payOSService = require("../services/payosService");
const User = require("../models/User");
const { createNotification } = require("./notificationController");

// Helper function để enrich variant data từ Product
const enrichVariantFromProduct = async (item) => {
  if (!item.variant || !item.variant._id) return item.variant;

  // Handle productId có thể là ObjectId hoặc object đã populate
  const productId = item.productId?._id
    ? item.productId._id.toString()
    : item.productId?.toString
    ? item.productId.toString()
    : item.productId;

  const product = await Product.findById(productId);
  if (!product || !product.variants || product.variants.length === 0) {
    return item.variant;
  }

  const variantFromProduct = product.variants.find(
    (v) => v._id.toString() === item.variant._id.toString()
  );

  if (variantFromProduct) {
    return {
      _id: variantFromProduct._id,
      size: variantFromProduct.size || item.variant.size,
      color: variantFromProduct.color || item.variant.color,
      price: variantFromProduct.price || item.variant.price,
      countInStock: variantFromProduct.countInStock,
      image: variantFromProduct.image || item.variant.image,
    };
  }

  return item.variant;
};

// Helper function để enrich order items với variant data
const enrichOrderItems = async (order) => {
  if (!order || !order.items || order.items.length === 0) return order;

  // Convert mongoose document to plain object if needed
  const orderObj = order.toObject ? order.toObject() : order;

  const enrichedItems = await Promise.all(
    orderObj.items.map(async (item) => {
      if (!item.variant || !item.variant._id) {
        return item;
      }

      const enrichedVariant = await enrichVariantFromProduct(item);
      return {
        ...item,
        variant: enrichedVariant,
      };
    })
  );

  return {
    ...orderObj,
    items: enrichedItems,
  };
};

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
      discountAmount: frontendDiscountAmount = 0,
      voucherInfo,
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
        return res.status(404).json({
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
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ${product.name} không đủ số lượng`,
        });
      }
    }

    // 2️⃣ Enrich variant data từ product trước khi lưu order
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        if (!item.variant || !item.variant._id) {
          return item;
        }

        const product = await Product.findById(item.productId);
        if (!product || !product.variants || product.variants.length === 0) {
          return item;
        }

        const variantFromProduct = product.variants.find(
          (v) => v._id.toString() === item.variant._id.toString()
        );

        if (variantFromProduct) {
          return {
            ...item,
            variant: {
              _id: variantFromProduct._id,
              size: variantFromProduct.size || item.variant.size,
              color: variantFromProduct.color || item.variant.color,
              price: variantFromProduct.price || item.variant.price,
              countInStock: variantFromProduct.countInStock,
              image: variantFromProduct.image || item.variant.image,
            },
          };
        }

        return item;
      })
    );

    // 3️⃣ Áp dụng giảm giá từ frontend (voucher 5%, tối đa 10,000₫)
    let discountAmount = 0;
    if (frontendDiscountAmount > 0) {
      // Giới hạn tối đa 10,000₫ và đảm bảo không âm
      discountAmount = Math.min(Math.max(0, frontendDiscountAmount), 10000);
    }
    const adjustedItemsPrice = itemsPrice;
    const finalTotalPrice = adjustedItemsPrice + taxPrice + shippingPrice - discountAmount;

    // 4️⃣ Xử lý theo payment method
    if (paymentMethod === "PayOS") {
      // Với PayOS: Chỉ tạo PendingOrder, KHÔNG tạo Order cho đến khi thanh toán thành công
      try {
        // Tạo orderCode cho PayOS
        const payOSOrderCode = parseInt(Date.now().toString().slice(-9));
        
        const payOSItems = enrichedItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: Math.round(i.price),
        }));
        const shortDesc = `Thanh toán DH #${payOSOrderCode.toString().slice(-6)}`;
        
        // Tạo payment link trước
        const paymentData = {
          orderId: payOSOrderCode.toString(), // Dùng orderCode tạm
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

        // Tạo PendingOrder để lưu thông tin tạm
        const pendingOrder = await PendingOrder.create({
          userId: req.user.id,
          items: enrichedItems,
          shippingAddress,
          itemsPrice: adjustedItemsPrice,
          taxPrice,
          shippingPrice,
          totalPrice: finalTotalPrice,
          discountAmount,
          discountApplied: discountAmount > 0,
          payOSOrderCode: paymentResult.orderCode,
          payOSPaymentLinkId: paymentResult.data.paymentLinkId,
          payOSCheckoutUrl: paymentResult.data.checkoutUrl,
          payOSQrCode: paymentResult.data.qrCode,
        });

        return res.status(200).json({
          success: true,
          message: "Vui lòng thanh toán để hoàn tất đơn hàng",
          data: {
            _id: pendingOrder._id,
            payOSOrderCode: pendingOrder.payOSOrderCode,
            paymentMethod: "PayOS",
            totalPrice: finalTotalPrice,
            discountAmount,
            discountApplied: discountAmount > 0,
          },
          payOS: {
            checkoutUrl: paymentResult.data.checkoutUrl,
            qrCode: paymentResult.data.qrCode,
            orderCode: paymentResult.orderCode,
          },
        });
      } catch (err) {
        console.error("❌ Lỗi PayOS:", err);
        return res.status(500).json({
          success: false,
          message: `Tạo payment link thất bại: ${err.message}`,
        });
      }
    }

    // 5️⃣ Nếu COD: Tạo Order và trừ kho ngay
    const order = await Order.create({
      userId: req.user.id,
      items: enrichedItems,
      shippingAddress,
      paymentMethod,
      itemsPrice: adjustedItemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice: finalTotalPrice,
      discountAmount,
      discountApplied: discountAmount > 0,
    });

    // Trừ kho cho COD
    for (const item of enrichedItems) {
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

    // 6️⃣ Populate và enrich order data
    let orderData = await Order.findById(order._id)
      .populate("userId", "name email")
      .populate("items.productId", "name image");

    orderData = await enrichOrderItems(orderData);

    // 7️⃣ Tạo thông báo cho người mua và admin/staff
    try {
      await createNotification(
        req.user.id,
        "order_created",
        "Đơn hàng đã được tạo",
        `Đơn hàng #${order._id.toString().slice(-6)} đã được tạo thành công.`,
        `/order-history`
      );

      const staffUsers = await User.find({ role: { $in: ["admin", "staff", "seller"] } }).select("_id");
      await Promise.all(
        staffUsers.map((u) =>
          createNotification(
            u._id,
            "order_new",
            "Đơn hàng mới",
            `Có đơn hàng mới #${order._id.toString().slice(-6)} cần xử lý.`,
            `/admin/orders`
          )
        )
      );
    } catch (notifErr) {
      console.error("Error creating order notifications:", notifErr);
    }

    res.status(201).json({
      success: true,
      message:
        discountAmount > 0
          ? "Đặt hàng thành công — Voucher 5% đã được áp dụng!"
          : "Đặt hàng thành công",
      data: orderData,
      discountApplied: discountAmount > 0,
      discountAmount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ==================== CẬP NHẬT THANH TOÁN ONLINE ====================
exports.updateOrderToPaid = async (req, res) => {
  try {
    // Tìm PendingOrder theo _id (frontend gửi pendingOrderId)
    const pendingOrder = await PendingOrder.findById(req.params.id);
    
    if (!pendingOrder) {
      // Có thể order đã được tạo rồi, kiểm tra xem có Order nào với payOSOrderCode không
      const existingOrder = await Order.findOne({
        "paymentResult.payOSData.orderCode": req.body.id || req.params.id,
      });
      
      if (existingOrder && existingOrder.isPaid) {
        let populatedOrder = await Order.findById(existingOrder._id)
          .populate("userId", "name email")
          .populate("items.productId", "name image");
        populatedOrder = await enrichOrderItems(populatedOrder);
        
        return res.status(200).json({
          success: true,
          message: "Đơn hàng đã được thanh toán trước đó",
          data: populatedOrder,
        });
      }
      
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng chờ thanh toán" });
    }

    // Kiểm tra lại tồn kho trước khi tạo order (có thể đã thay đổi)
    for (const item of pendingOrder.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        await PendingOrder.findByIdAndDelete(pendingOrder._id);
        return res.status(404).json({
          success: false,
          message: `Sản phẩm ${item.name} không tồn tại`,
        });
      }

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
        await PendingOrder.findByIdAndDelete(pendingOrder._id);
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ${product.name} không đủ số lượng`,
        });
      }
    }

    // Tạo Order từ PendingOrder
    const order = await Order.create({
      userId: pendingOrder.userId,
      items: pendingOrder.items,
      shippingAddress: pendingOrder.shippingAddress,
      paymentMethod: "PayOS",
      itemsPrice: pendingOrder.itemsPrice,
      taxPrice: pendingOrder.taxPrice,
      shippingPrice: pendingOrder.shippingPrice,
      totalPrice: pendingOrder.totalPrice,
      discountAmount: pendingOrder.discountAmount,
      discountApplied: pendingOrder.discountApplied,
      isPaid: true,
      paidAt: new Date(),
      paymentResult: {
        provider: "PayOS",
        payOSData: {
          orderCode: pendingOrder.payOSOrderCode,
          paymentLinkId: pendingOrder.payOSPaymentLinkId,
          checkoutUrl: pendingOrder.payOSCheckoutUrl,
          qrCode: pendingOrder.payOSQrCode,
        },
        status: req.body.status || "PAID",
        update_time: req.body.update_time || new Date(),
        email_address: req.body.email_address,
      },
    });

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

    // Xóa PendingOrder sau khi đã tạo Order thành công
    await PendingOrder.findByIdAndDelete(pendingOrder._id);

    // Tạo thông báo cho người mua và admin/staff
    try {
      await createNotification(
        order.userId,
        "order_created",
        "Đơn hàng đã được tạo",
        `Đơn hàng #${order._id.toString().slice(-6)} đã được thanh toán và tạo thành công.`,
        `/order-history`
      );

      const staffUsers = await User.find({ role: { $in: ["admin", "staff", "seller"] } }).select("_id");
      await Promise.all(
        staffUsers.map((u) =>
          createNotification(
            u._id,
            "order_new",
            "Đơn hàng mới",
            `Có đơn hàng mới #${order._id.toString().slice(-6)} cần xử lý.`,
            `/admin/orders`
          )
        )
      );
    } catch (notifErr) {
      console.error("Error creating order notifications:", notifErr);
    }

    let populatedOrder = await Order.findById(order._id)
      .populate("userId", "name email")
      .populate("items.productId", "name image");

    populatedOrder = await enrichOrderItems(populatedOrder);

    res.status(200).json({
      success: true,
      message: "Thanh toán thành công và đơn hàng đã được tạo",
      data: populatedOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CẬP NHẬT TRẠNG THÁI ====================
// controllers/orderController.js
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const paymentMethod = order.paymentMethod;
    const targetStatus = status;
    const normalizedStatus = targetStatus.toLowerCase();

    if (normalizedStatus === order.status.toLowerCase() && normalizedStatus !== "cancelled") {
      let unchangedOrder = await Order.findById(order._id)
        .populate("userId", "name email")
        .populate("items.productId", "name image");
      unchangedOrder = await enrichOrderItems(unchangedOrder);
      return res.status(200).json({
        success: true,
        message: "Trạng thái không thay đổi",
        data: unchangedOrder,
      });
    }

    if (normalizedStatus === "cancelled") {
      if (order.status === "Cancelled") {
        return res.status(400).json({
          success: false,
          message: "Đơn hàng đã bị hủy trước đó.",
        });
      }

      if (!cancelReason || cancelReason.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Vui lòng cung cấp lý do hủy đơn.",
        });
      }

      // Hoàn lại tồn kho nếu đơn chưa bị hủy trước đó
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        if (item.variant && product.variants && product.variants.length > 0) {
          const vIndex = product.variants.findIndex(
            (v) => v._id.toString() === item.variant._id.toString()
          );
          if (vIndex >= 0) {
            product.variants[vIndex].countInStock += item.quantity;
          }
          product.countInStock = product.variants.reduce(
            (sum, v) => sum + (v.countInStock || 0),
            0
          );
        } else {
          product.countInStock += item.quantity;
        }
        await product.save();
      }

      order.status = "Cancelled";
      order.cancelReason = cancelReason.trim();
      order.isPaid = false;
      order.paidAt = undefined;
      order.isDelivered = false;
      order.deliveredAt = undefined;
    } else {
      order.status = targetStatus;
      order.cancelReason = undefined;

      if (targetStatus === "Delivered") {
        order.isDelivered = true;
        if (!order.deliveredAt) {
          order.deliveredAt = new Date();
        }

        if (paymentMethod === "COD" && !order.isPaid) {
          order.isPaid = true;
          order.paidAt = new Date();
        }

        if (paymentMethod !== "COD") {
          order.isPaid = true;
          if (!order.paidAt) order.paidAt = new Date();
        }
      } else {
        order.isDelivered = false;
        order.deliveredAt = undefined;

        if (paymentMethod === "COD") {
          order.isPaid = false;
          order.paidAt = undefined;
        }
      }
    }

    await order.save();

    let updatedOrder = await Order.findById(order._id)
      .populate("userId", "name email")
      .populate("items.productId", "name image");
    updatedOrder = await enrichOrderItems(updatedOrder);

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LẤY ORDER THEO ID ====================
exports.getOrderById = async (req, res) => {
  try {
    let order = await Order.findById(req.params.id)
      .populate("userId", "name email")
      .populate("items.productId", "name image price");
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    if (
      order.userId._id.toString() !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "staff" &&
      req.user.role !== "seller"
    ) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem đơn hàng này",
      });
    }

    // Enrich variant data
    order = await enrichOrderItems(order);

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

    // Enrich variant data cho tất cả orders
    const enrichedOrders = await Promise.all(
      orders.map((order) => enrichOrderItems(order))
    );

    res.status(200).json({ success: true, data: enrichedOrders });
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

    // Enrich variant data cho tất cả orders
    const enrichedOrders = await Promise.all(
      orders.map((order) => enrichOrderItems(order))
    );

    res.status(200).json({
      success: true,
      data: enrichedOrders,
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
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy đơn hàng này",
      });
    if (order.status !== "Pending")
      return res.status(400).json({
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

    let updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Cancelled" },
      { new: true }
    );

    // Enrich variant data
    updatedOrder = await enrichOrderItems(updatedOrder);

    res.status(200).json({
      success: true,
      message: "Hủy đơn hàng thành công",
      data: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
