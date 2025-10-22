const Order = require("../models/Order");
const Product = require("../models/Product");

// Tạo order mới
exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Giỏ hàng trống"
      });
    }

    // Kiểm tra và update stock cho từng sản phẩm
    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Sản phẩm ${item.name} không tồn tại`
        });
      }

      if (product.countInStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ${product.name} không đủ số lượng trong kho`
        });
      }
    }

    const order = await Order.create({
      userId: req.user.id,
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice
    });

    // Cập nhật stock của các sản phẩm
    for (let item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { countInStock: -item.quantity } }
      );
    }

    const populatedOrder = await Order.findById(order._id)
      .populate('userId', 'name email')
      .populate('items.productId', 'name image');

    res.status(201).json({
      success: true,
      message: "Đặt hàng thành công",
      data: populatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

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
      .populate('userId', 'name email')
      .populate('items.productId', 'name image')
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
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy orders của user hiện tại
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate('items.productId', 'name image')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy order theo ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('items.productId', 'name image price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng"
      });
    }

    // Kiểm tra quyền truy cập (chỉ user sở hữu hoặc admin)
    if (order.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem đơn hàng này"
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật trạng thái order (cho admin/staff)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ"
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng"
      });
    }

    const updateData = { status };

    // Tự động cập nhật deliveredAt khi status = Delivered
    if (status === 'Delivered') {
      updateData.isDelivered = true;
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('userId', 'name email').populate('items.productId', 'name image');

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái đơn hàng thành công",
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật thanh toán
exports.updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng"
      });
    }

    const { id, status, update_time, email_address } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        isPaid: true,
        paidAt: new Date(),
        paymentResult: {
          id,
          status,
          update_time,
          email_address
        }
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật thanh toán thành công",
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Hủy order (chỉ khi status = Pending)
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng"
      });
    }

    // Kiểm tra quyền hủy (chỉ user sở hữu)
    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy đơn hàng này"
      });
    }

    // Chỉ cho phép hủy khi status = Pending
    if (order.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: "Không thể hủy đơn hàng đã được xử lý"
      });
    }

    // Hoàn lại stock cho các sản phẩm
    for (let item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { countInStock: item.quantity } }
      );
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status: 'Cancelled' },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Hủy đơn hàng thành công",
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};