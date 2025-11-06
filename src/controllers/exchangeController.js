const Exchange = require("../models/Exchange");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Notification = require("../models/Notification");

// ==================== TẠO YÊU CẦU ĐỔI HÀNG ====================
exports.createExchange = async (req, res) => {
  try {
    const {
      originalOrderId,
      itemsToReturn,
      itemsToExchange,
      reason,
      paymentMethod = "COD",
    } = req.body;

    console.log("📥 Received exchange request:", {
      originalOrderId,
      itemsToReturnCount: itemsToReturn?.length,
      itemsToExchangeCount: itemsToExchange?.length,
      reason,
      paymentMethod,
      userId: req.user.id,
    });

    // 1️⃣ Kiểm tra đơn hàng gốc
    const originalOrder = await Order.findById(originalOrderId)
      .populate("items.productId", "name image variants");
    
    if (!originalOrder) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    // Chỉ cho phép đổi hàng từ đơn đã giao
    // Kiểm tra cả status và isDelivered
    if (originalOrder.status !== "Delivered") {
      console.log("❌ Order status check failed:", {
        orderId: originalOrder._id,
        status: originalOrder.status,
        isDelivered: originalOrder.isDelivered,
      });
      return res.status(400).json({
        success: false,
        message: `Chỉ có thể đổi hàng từ đơn hàng đã giao. Đơn hàng hiện tại có trạng thái: ${originalOrder.status}`,
      });
    }
    
    // Kiểm tra isDelivered (có thể không bắt buộc nếu status đã là Delivered)
    if (!originalOrder.isDelivered && originalOrder.status === "Delivered") {
      console.log("⚠️ Warning: Order status is Delivered but isDelivered is false");
      // Có thể tự động set isDelivered = true nếu status là Delivered
      originalOrder.isDelivered = true;
      await originalOrder.save();
    }

    // Kiểm tra quyền sở hữu
    if (originalOrder.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền đổi hàng từ đơn này",
      });
    }

    // 2️⃣ Kiểm tra tồn kho cho sản phẩm mới
    for (const item of itemsToExchange) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Sản phẩm ${item.name} không tồn tại`,
        });
      }

      let variantStock = null;
      if (item.variant && item.variant._id && product.variants && product.variants.length > 0) {
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

    // 3️⃣ Tạo yêu cầu đổi hàng và lưu vào database exchanges
    const exchangeData = {
      originalOrderId,
      userId: req.user.id,
      itemsToReturn,
      itemsToExchange,
      reason,
      shippingAddress: originalOrder.shippingAddress,
      paymentMethod,
      status: "Pending",
    };

    console.log("💾 Creating exchange in database with data:", {
      originalOrderId: exchangeData.originalOrderId,
      userId: exchangeData.userId,
      itemsToReturnCount: exchangeData.itemsToReturn?.length,
      itemsToExchangeCount: exchangeData.itemsToExchange?.length,
      status: exchangeData.status,
    });

    const exchange = await Exchange.create(exchangeData);

    console.log("✅ Exchange created successfully in database exchanges:", {
      exchangeId: exchange._id,
      status: exchange.status,
      createdAt: exchange.createdAt,
    });

    const populatedExchange = await Exchange.findById(exchange._id)
      .populate("originalOrderId")
      .populate("userId", "name email")
      .populate("itemsToReturn.productId", "name image")
      .populate("itemsToExchange.productId", "name image");

    res.status(201).json({
      success: true,
      message: "Yêu cầu đổi hàng đã được gửi thành công. Seller sẽ xem xét và phản hồi.",
      data: populatedExchange,
    });
  } catch (error) {
    console.error("❌ Error creating exchange:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    // Nếu là lỗi validation từ Mongoose
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Lỗi validation: " + validationErrors.join(", "),
        errors: validationErrors,
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || "Không thể tạo yêu cầu đổi hàng",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ==================== LẤY DANH SÁCH ĐỔI HÀNG CỦA USER ====================
exports.getMyExchanges = async (req, res) => {
  try {
    const exchanges = await Exchange.find({ userId: req.user.id })
      .populate("originalOrderId")
      .populate("newOrderId")
      .populate("itemsToReturn.productId", "name image")
      .populate("itemsToExchange.productId", "name image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: exchanges,
    });
  } catch (error) {
    console.error("Error fetching exchanges:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== LẤY CHI TIẾT YÊU CẦU ĐỔI HÀNG ====================
exports.getExchangeById = async (req, res) => {
  try {
    const exchange = await Exchange.findById(req.params.id)
      .populate("originalOrderId")
      .populate("newOrderId")
      .populate("userId", "name email")
      .populate("itemsToReturn.productId", "name image variants")
      .populate("itemsToExchange.productId", "name image variants");

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đổi hàng",
      });
    }

    // Kiểm tra quyền truy cập (user hoặc admin/seller)
    if (exchange.userId._id.toString() !== req.user.id && 
        !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem yêu cầu này",
      });
    }

    res.status(200).json({
      success: true,
      data: exchange,
    });
  } catch (error) {
    console.error("Error fetching exchange:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== ADMIN/SELLER: LẤY TẤT CẢ YÊU CẦU ĐỔI HÀNG ====================
exports.getAllExchanges = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const exchanges = await Exchange.find(filter)
      .populate("originalOrderId")
      .populate("newOrderId")
      .populate("userId", "name email")
      .populate("itemsToReturn.productId", "name image")
      .populate("itemsToExchange.productId", "name image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: exchanges,
    });
  } catch (error) {
    console.error("Error fetching exchanges:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== SELLER/ADMIN: CẬP NHẬT TRẠNG THÁI ĐỔI HÀNG ====================
exports.updateExchangeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const exchange = await Exchange.findById(id)
      .populate("originalOrderId")
      .populate("itemsToReturn.productId", "name image variants")
      .populate("itemsToExchange.productId", "name image variants");

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đổi hàng",
      });
    }

    // Nếu đã approve hoặc reject rồi thì không cho cập nhật
    if (exchange.status === "Approved" || exchange.status === "Rejected") {
      return res.status(400).json({
        success: false,
        message: `Yêu cầu đã được ${exchange.status === "Approved" ? "duyệt" : "từ chối"}`,
      });
    }

    // Nếu approve, tạo đơn hàng mới và cập nhật inventory
    if (status === "Approved") {
      // Kiểm tra lại tồn kho
      for (const item of exchange.itemsToExchange) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Sản phẩm ${item.name} không tồn tại`,
          });
        }

        let variantStock = null;
        if (item.variant && item.variant._id && product.variants && product.variants.length > 0) {
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

      // Tính toán giá chênh lệch
      // Tổng giá sản phẩm trả lại
      const totalReturnPrice = exchange.itemsToReturn.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      
      // Tổng giá sản phẩm muốn đổi
      const totalExchangePrice = exchange.itemsToExchange.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      
      // Giá chênh lệch (chỉ tính phần cao hơn)
      const priceDifference = totalExchangePrice - totalReturnPrice;
      
      console.log("💰 Price calculation:", {
        totalReturnPrice,
        totalExchangePrice,
        priceDifference,
      });

      // Nếu giá chênh lệch <= 0 (cùng giá hoặc thấp hơn), không tạo đơn hàng mới
      // Chỉ cập nhật inventory và đánh dấu exchange là Completed
      if (priceDifference <= 0) {
        console.log("✅ No price difference, only updating inventory");
        
        // Cập nhật inventory: trả hàng cũ vào kho, trừ hàng mới ra khỏi kho
        // 1. Trả hàng cũ vào kho
        for (const item of exchange.itemsToReturn) {
          const product = await Product.findById(item.productId);
          if (!product) continue;

          if (item.variant && item.variant._id && product.variants && product.variants.length > 0) {
            const vIndex = product.variants.findIndex(
              (v) => v._id.toString() === item.variant._id.toString()
            );
            if (vIndex >= 0) {
              product.variants[vIndex].countInStock += item.quantity;
            }
          } else {
            product.countInStock += item.quantity;
          }

          product.countInStock = product.variants.reduce(
            (sum, v) => sum + (v.countInStock || 0),
            0
          );
          await product.save();

          await Inventory.create({
            productId: item.productId,
            variant: item.variant,
            type: "import",
            quantity: item.quantity,
            note: `Đổi hàng - Trả hàng từ đơn #${exchange.originalOrderId._id.toString().slice(-6)}`,
            stockAfter: product.countInStock,
            exchangeId: exchange._id,
          });
        }

        // 2. Trừ hàng mới ra khỏi kho
        for (const item of exchange.itemsToExchange) {
          const product = await Product.findById(item.productId);
          if (!product) continue;

          if (item.variant && item.variant._id && product.variants && product.variants.length > 0) {
            const vIndex = product.variants.findIndex(
              (v) => v._id.toString() === item.variant._id.toString()
            );
            if (vIndex >= 0) {
              product.variants[vIndex].countInStock -= item.quantity;
            }
          } else {
            product.countInStock -= item.quantity;
          }

          product.countInStock = product.variants.reduce(
            (sum, v) => sum + (v.countInStock || 0),
            0
          );
          await product.save();

          await Inventory.create({
            productId: item.productId,
            variant: item.variant,
            type: "export",
            quantity: item.quantity,
            note: `Đổi hàng - Đổi hàng từ đơn #${exchange.originalOrderId._id.toString().slice(-6)}`,
            stockAfter: product.countInStock,
            exchangeId: exchange._id,
          });
        }

        // Cập nhật exchange
        exchange.status = "Approved";
        exchange.newOrderId = null; // Không có đơn hàng mới vì không có chênh lệch giá
        if (adminNotes) exchange.adminNotes = adminNotes;
        await exchange.save();

        const populatedExchange = await Exchange.findById(exchange._id)
          .populate("originalOrderId")
          .populate("userId", "name email")
          .populate("itemsToReturn.productId", "name image")
          .populate("itemsToExchange.productId", "name image");

        // Tạo thông báo cho user
        try {
          await Notification.create({
            userId: exchange.userId,
            type: "exchange_approved",
            title: "Yêu cầu đổi hàng đã được duyệt",
            message: "Yêu cầu đổi hàng của bạn đã được duyệt. Không có chênh lệch giá nên không cần thanh toán thêm.",
            link: "/order-history",
            metadata: { exchangeId: exchange._id },
          });
        } catch (notifError) {
          console.error("Error creating notification:", notifError);
        }

        return res.status(200).json({
          success: true,
          message: "Yêu cầu đổi hàng đã được duyệt. Không có chênh lệch giá nên không tạo đơn hàng mới.",
          data: populatedExchange,
          newOrder: null,
        });
      }

      // Nếu có chênh lệch giá > 0, tạo đơn hàng mới chỉ với phần chênh lệch
      const taxPrice = Math.round(priceDifference * 0.1); // 10% thuế trên phần chênh lệch
      const shippingPrice = 0; // Miễn phí ship cho đơn đổi hàng
      const totalPrice = priceDifference + taxPrice + shippingPrice;

      console.log("💰 Creating new order with price difference:", {
        priceDifference,
        taxPrice,
        totalPrice,
      });

      // Tạo đơn hàng mới chỉ với phần chênh lệch giá
      // Lưu ý: items vẫn là itemsToExchange để biết sản phẩm được đổi
      const newOrder = await Order.create({
        userId: exchange.userId,
        items: exchange.itemsToExchange,
        shippingAddress: exchange.shippingAddress,
        paymentMethod: exchange.paymentMethod,
        itemsPrice: priceDifference, // Chỉ tính phần chênh lệch
        taxPrice,
        shippingPrice,
        totalPrice,
        discountApplied: false,
        discountAmount: 0,
        status: "Pending",
        notes: `Đơn hàng đổi từ đơn #${exchange.originalOrderId._id.toString().slice(-6)}. Chênh lệch giá: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(priceDifference)}`,
      });

      console.log("✅ New order created for exchange:", {
        exchangeId: exchange._id,
        newOrderId: newOrder._id,
        userId: exchange.userId,
        totalPrice: newOrder.totalPrice,
      });

      // Cập nhật exchange với newOrderId
      exchange.newOrderId = newOrder._id;
      exchange.status = "Approved";
      if (adminNotes) exchange.adminNotes = adminNotes;

      // Cập nhật inventory: trả hàng cũ vào kho, trừ hàng mới ra khỏi kho
      // 1. Trả hàng cũ vào kho
      for (const item of exchange.itemsToReturn) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        if (item.variant && item.variant._id && product.variants && product.variants.length > 0) {
          const vIndex = product.variants.findIndex(
            (v) => v._id.toString() === item.variant._id.toString()
          );
          if (vIndex >= 0) {
            product.variants[vIndex].countInStock += item.quantity;
          }
        } else {
          product.countInStock += item.quantity;
        }

        // Cập nhật tổng countInStock
        product.countInStock = product.variants.reduce(
          (sum, v) => sum + (v.countInStock || 0),
          0
        );
        await product.save();

        // Ghi inventory
        await Inventory.create({
          productId: item.productId,
          variant: item.variant,
          type: "import",
          quantity: item.quantity,
          note: `Đổi hàng - Trả hàng từ đơn #${exchange.originalOrderId._id.toString().slice(-6)}`,
          stockAfter: product.countInStock,
          exchangeId: exchange._id,
        });
      }

      // 2. Trừ hàng mới ra khỏi kho
      for (const item of exchange.itemsToExchange) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        if (item.variant && item.variant._id && product.variants && product.variants.length > 0) {
          const vIndex = product.variants.findIndex(
            (v) => v._id.toString() === item.variant._id.toString()
          );
          if (vIndex >= 0) {
            product.variants[vIndex].countInStock -= item.quantity;
          }
        } else {
          product.countInStock -= item.quantity;
        }

        // Cập nhật tổng countInStock
        product.countInStock = product.variants.reduce(
          (sum, v) => sum + (v.countInStock || 0),
          0
        );
        await product.save();

        // Ghi inventory
        await Inventory.create({
          productId: item.productId,
          variant: item.variant,
          type: "export",
          quantity: item.quantity,
          note: `Đổi hàng - Bán hàng mới cho đơn #${newOrder._id.toString().slice(-6)}`,
          stockAfter: product.countInStock,
          orderId: newOrder._id,
          exchangeId: exchange._id,
        });
      }

      await exchange.save();

      const populatedExchange = await Exchange.findById(exchange._id)
        .populate("originalOrderId")
        .populate("newOrderId")
        .populate("userId", "name email")
        .populate("itemsToReturn.productId", "name image")
        .populate("itemsToExchange.productId", "name image");

      // Tạo thông báo cho user
      try {
        await Notification.create({
          userId: exchange.userId,
          type: "exchange_approved",
          title: "Yêu cầu đổi hàng đã được duyệt",
          message: `Yêu cầu đổi hàng của bạn đã được duyệt. Đơn hàng mới #${newOrder._id.toString().slice(-6)} đã được tạo với chênh lệch giá ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(totalPrice)}.`,
          link: "/order-history",
          metadata: { exchangeId: exchange._id, newOrderId: newOrder._id },
        });
      } catch (notifError) {
        console.error("Error creating notification:", notifError);
      }

      return res.status(200).json({
        success: true,
        message: "Yêu cầu đổi hàng đã được duyệt. Đơn hàng mới đã được tạo.",
        data: populatedExchange,
        newOrder,
      });
    }

    // Nếu reject hoặc các trạng thái khác
    exchange.status = status;
    if (adminNotes) exchange.adminNotes = adminNotes;
    await exchange.save();

    const populatedExchange = await Exchange.findById(exchange._id)
      .populate("originalOrderId")
      .populate("newOrderId")
      .populate("userId", "name email")
      .populate("itemsToReturn.productId", "name image")
      .populate("itemsToExchange.productId", "name image");

    // Tạo thông báo cho user nếu bị từ chối
    if (status === "Rejected") {
      try {
        await Notification.create({
          userId: exchange.userId,
          type: "exchange_rejected",
          title: "Yêu cầu đổi hàng bị từ chối",
          message: adminNotes || "Yêu cầu đổi hàng của bạn đã bị từ chối. Vui lòng liên hệ admin để biết thêm chi tiết.",
          link: "/order-history",
          metadata: { exchangeId: exchange._id },
        });
      } catch (notifError) {
        console.error("Error creating notification:", notifError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Yêu cầu đổi hàng đã được ${status === "Rejected" ? "từ chối" : "cập nhật"}`,
      data: populatedExchange,
    });
  } catch (error) {
    console.error("Error updating exchange status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== USER: HỦY YÊU CẦU ĐỔI HÀNG ====================
exports.cancelExchange = async (req, res) => {
  try {
    const { id } = req.params;

    const exchange = await Exchange.findById(id);

    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đổi hàng",
      });
    }

    // Kiểm tra quyền sở hữu
    if (exchange.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy yêu cầu này",
      });
    }

    // Chỉ cho phép hủy khi đang Pending
    if (exchange.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể hủy yêu cầu đang chờ xử lý",
      });
    }

    exchange.status = "Cancelled";
    await exchange.save();

    res.status(200).json({
      success: true,
      message: "Yêu cầu đổi hàng đã được hủy",
      data: exchange,
    });
  } catch (error) {
    console.error("Error cancelling exchange:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

