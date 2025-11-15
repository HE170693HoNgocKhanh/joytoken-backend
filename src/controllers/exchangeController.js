const Exchange = require("../models/Exchange");
const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Notification = require("../models/Notification");
const payOSService = require("../services/payosService");

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

    // Kiểm tra thời gian: chỉ cho phép đổi hàng trong vòng 3 ngày kể từ ngày nhận (deliveredAt)
    if (!originalOrder.deliveredAt) {
      return res.status(400).json({
        success: false,
        message: "Không thể xác định ngày nhận hàng. Vui lòng liên hệ admin.",
      });
    }

    const deliveredDate = new Date(originalOrder.deliveredAt);
    const now = new Date();
    const daysSinceDelivery = Math.floor((now - deliveredDate) / (1000 * 60 * 60 * 24));

    if (daysSinceDelivery > 3) {
      return res.status(400).json({
        success: false,
        message: `Chỉ có thể đổi hàng trong vòng 3 ngày kể từ ngày nhận hàng. Đơn hàng đã được giao từ ${daysSinceDelivery} ngày trước (${deliveredDate.toLocaleDateString("vi-VN")}).`,
      });
    }

    // Kiểm tra quyền sở hữu
    if (originalOrder.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền đổi hàng từ đơn này",
      });
    }

    // ✅ Kiểm tra xem đơn hàng này đã có exchange request đang pending chưa
    const existingExchange = await Exchange.findOne({
      originalOrderId: originalOrderId,
      userId: req.user.id,
      status: { $in: ["Pending", "Approved"] }, // Chỉ check Pending và Approved (chưa Completed/Cancelled)
    });

    if (existingExchange) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng này đang có yêu cầu đổi hàng đang xử lý (trạng thái: ${existingExchange.status === "Pending" ? "Đang chờ" : "Đã duyệt"}). Vui lòng chờ xử lý xong trước khi tạo yêu cầu mới.`,
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

    // 3️⃣ Tính toán giá chênh lệch
    const totalReturnPrice = itemsToReturn.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    const totalExchangePrice = itemsToExchange.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    const priceDifference = totalExchangePrice - totalReturnPrice;
    
    console.log("💰 Price calculation:", {
      totalReturnPrice,
      totalExchangePrice,
      priceDifference,
      paymentMethod,
    });

    // 4️⃣ Nếu có chênh lệch giá > 0, xử lý theo paymentMethod
    if (priceDifference > 0) {
      // Nếu là PayOS, tạo payment link
      if (paymentMethod === "PayOS") {
        try {
        // Tạo Exchange trước để có exchangeId
        const exchangeDataForPayOS = {
          originalOrderId,
          userId: req.user.id,
          itemsToReturn,
          itemsToExchange,
          reason,
          shippingAddress: originalOrder.shippingAddress,
          paymentMethod,
          status: "Pending", // Vẫn là Pending, sẽ được approve sau khi thanh toán
        };

        const exchange = await Exchange.create(exchangeDataForPayOS);

        const taxPrice = Math.round(priceDifference * 0.1); // 10% thuế trên phần chênh lệch
        const shippingPrice = 0; // Miễn phí ship cho đơn đổi hàng
        const totalPrice = priceDifference + taxPrice + shippingPrice;

        // Tạo orderCode cho PayOS
        const payOSOrderCode = parseInt(Date.now().toString().slice(-9));
        
        const payOSItems = itemsToExchange.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: Math.round(i.price),
        }));
        // PayOS yêu cầu description tối đa 25 ký tự
        const shortDesc = `Đổi hàng #${exchange._id.toString().slice(-6)}`;
        
        // Lấy thông tin user
        const User = require("../models/User");
        const user = await User.findById(req.user.id).select("email name");
        
        // Tạo payment link với exchangeId
        const paymentData = {
          orderId: payOSOrderCode.toString(),
          amount: Math.round(totalPrice),
          description: shortDesc,
          buyerName: originalOrder.shippingAddress.fullName,
          buyerEmail: user?.email || "",
          buyerPhone: originalOrder.shippingAddress.phone,
          buyerAddress: `${originalOrder.shippingAddress.address}, ${originalOrder.shippingAddress.city}`,
          items: payOSItems,
          returnUrl: `${process.env.FRONTEND_URL}/exchange-payment-success?exchangeId=${exchange._id}`,
          cancelUrl: `${process.env.FRONTEND_URL}/exchange-payment-failure?exchangeId=${exchange._id}`,
        };
        const paymentResult = await payOSService.createPaymentLink(paymentData);

        // Tạo PendingOrder để lưu thông tin tạm (CHƯA cập nhật inventory)
        const pendingOrder = await PendingOrder.create({
          userId: req.user.id,
          items: itemsToExchange,
          shippingAddress: originalOrder.shippingAddress,
          itemsPrice: priceDifference,
          taxPrice,
          shippingPrice,
          totalPrice,
          discountAmount: 0,
          discountApplied: false,
          payOSOrderCode: paymentResult.orderCode,
          payOSPaymentLinkId: paymentResult.data.paymentLinkId,
          payOSCheckoutUrl: paymentResult.data.checkoutUrl,
          payOSQrCode: paymentResult.data.qrCode,
          exchangeId: exchange._id, // Link với exchange
        });

        const populatedExchange = await Exchange.findById(exchange._id)
          .populate("originalOrderId")
          .populate("userId", "name email")
          .populate("itemsToReturn.productId", "name image")
          .populate("itemsToExchange.productId", "name image");

        // Tạo thông báo cho user
        try {
          const { createNotification } = require("./notificationController");
          await createNotification(
            req.user.id,
            "exchange_created",
            "Yêu cầu đổi hàng đã tạo",
            `Yêu cầu đổi hàng #${exchange._id.toString().slice(-6)} đã được tạo. Vui lòng thanh toán chênh lệch giá ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(totalPrice)} để hoàn tất.`,
            `/order-history`
          );
        } catch (notifErr) {
          console.error("Error creating exchange notifications:", notifErr);
        }

        return res.status(201).json({
          success: true,
          message: "Yêu cầu đổi hàng đã được tạo. Vui lòng thanh toán chênh lệch giá để hoàn tất.",
          data: populatedExchange,
          payOS: {
            checkoutUrl: paymentResult.data.checkoutUrl,
            qrCode: paymentResult.data.qrCode,
            orderCode: paymentResult.orderCode,
          },
          pendingOrderId: pendingOrder._id,
          totalPrice,
          requiresPayment: true,
        });
      } catch (payOSError) {
        console.error("❌ Lỗi tạo PayOS payment link:", payOSError);
        // Nếu lỗi PayOS, xóa exchange đã tạo (nếu có) và trả về lỗi
        // Không tiếp tục tạo exchange bình thường vì đã có exchange trong try block
        // Tìm và xóa exchange nếu đã được tạo
        try {
          const createdExchange = await Exchange.findOne({
            originalOrderId,
            userId: req.user.id,
            status: "Pending",
            paymentMethod: "PayOS",
          }).sort({ createdAt: -1 });
          if (createdExchange) {
            await Exchange.findByIdAndDelete(createdExchange._id);
          }
        } catch (deleteErr) {
          console.error("Error deleting exchange after PayOS error:", deleteErr);
        }
        return res.status(500).json({
          success: false,
          message: `Tạo payment link thất bại: ${payOSError.message}. Vui lòng thử lại.`,
        });
      }
      }
      // Nếu là COD và có chênh lệch giá, tạo exchange bình thường (chờ admin duyệt và sẽ tạo Order khi approve)
      // Code sẽ tiếp tục xuống phần 5️⃣
    }

    // 5️⃣ Nếu không có chênh lệch giá hoặc paymentMethod là COD, tạo exchange bình thường (chờ admin duyệt)
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

    // Tạo thông báo: cho user (đã gửi yêu cầu) và admin/seller (có yêu cầu mới)
    try {
      const { createNotification } = require("./notificationController");
      const User = require("../models/User");

      // Notify user
      await createNotification(
        req.user.id,
        "exchange_created",
        "Yêu cầu đổi hàng đã gửi",
        `Yêu cầu đổi hàng #${exchange._id.toString().slice(-6)} đã được gửi. Chờ duyệt.`,
        `/order-history`
      );

      // Notify admins/seller
      const staffUsers = await User.find({ role: { $in: ["admin", "seller"] } }).select("_id");
      await Promise.all(
        staffUsers.map((u) =>
          createNotification(
            u._id,
            "exchange_new",
            "Yêu cầu đổi hàng mới",
            `Có yêu cầu đổi hàng #${exchange._id.toString().slice(-6)} cần xem xét.`,
            `/admin/exchanges`
          )
        )
      );
    } catch (notifErr) {
      console.error("Error creating exchange notifications:", notifErr);
    }

    res.status(201).json({
      success: true,
      message: priceDifference <= 0 
        ? "Yêu cầu đổi hàng đã được gửi thành công. Không có chênh lệch giá nên không cần thanh toán."
        : "Yêu cầu đổi hàng đã được gửi thành công. Seller sẽ xem xét và phản hồi.",
      data: populatedExchange,
      requiresPayment: false,
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

      // Nếu có chênh lệch giá > 0, kiểm tra xem đã có PendingOrder chưa (user đã chọn PayOS)
      // Nếu đã có PendingOrder, không cần tạo lại payment link, chỉ approve exchange
      const existingPendingOrder = await PendingOrder.findOne({ exchangeId: exchange._id });
      
      if (existingPendingOrder) {
        // Đã có PendingOrder (user đã chọn PayOS và payment link đã được tạo)
        // Chỉ cần approve exchange, chờ user thanh toán
        exchange.status = "Approved";
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
            message: `Yêu cầu đổi hàng của bạn đã được duyệt. Vui lòng thanh toán chênh lệch giá để hoàn tất đổi hàng.`,
            link: "/order-history",
            metadata: { exchangeId: exchange._id, pendingOrderId: existingPendingOrder._id },
          });
        } catch (notifError) {
          console.error("Error creating notification:", notifError);
        }

        return res.status(200).json({
          success: true,
          message: "Yêu cầu đổi hàng đã được duyệt. Khách hàng cần thanh toán chênh lệch giá để hoàn tất.",
          data: populatedExchange,
          payOS: {
            checkoutUrl: existingPendingOrder.payOSCheckoutUrl,
            qrCode: existingPendingOrder.payOSQrCode,
            orderCode: existingPendingOrder.payOSOrderCode,
          },
          pendingOrderId: existingPendingOrder._id,
        });
      }

      // Nếu chưa có PendingOrder và có chênh lệch giá, xử lý theo payment method
      // Nếu là COD, tạo Order ngay lập tức
      if (exchange.paymentMethod === "COD") {
        const taxPrice = Math.round(priceDifference * 0.1);
        const shippingPrice = 0;
        const totalPrice = priceDifference + taxPrice + shippingPrice;

        // Tạo Order ngay cho COD
        const newOrder = await Order.create({
          userId: exchange.userId,
          items: exchange.itemsToExchange,
          shippingAddress: exchange.shippingAddress,
          paymentMethod: "COD",
          itemsPrice: priceDifference,
          taxPrice,
          shippingPrice,
          totalPrice,
          discountAmount: 0,
          discountApplied: false,
          isPaid: false, // COD chưa thanh toán
          status: "Pending",
          notes: `Đơn hàng đổi - Mã đơn gốc: #${exchange.originalOrderId._id.toString().slice(-6)}. Chênh lệch giá: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(priceDifference)}`,
        });

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
            note: `Đổi hàng - Bán hàng mới cho đơn #${newOrder._id.toString().slice(-6)}`,
            stockAfter: product.countInStock,
            orderId: newOrder._id,
            exchangeId: exchange._id,
          });
        }

        // Cập nhật exchange
        exchange.status = "Approved";
        exchange.newOrderId = newOrder._id;
        if (adminNotes) exchange.adminNotes = adminNotes;
        await exchange.save();

        const populatedExchange = await Exchange.findById(exchange._id)
          .populate("originalOrderId")
          .populate("newOrderId")
          .populate("userId", "name email")
          .populate("itemsToReturn.productId", "name image")
          .populate("itemsToExchange.productId", "name image");

        // Tạo thông báo cho user và admin/staff
        try {
          const { createNotification } = require("./notificationController");
          const User = require("../models/User");

          // Thông báo cho user
          await createNotification(
            exchange.userId,
            "exchange_approved",
            "Yêu cầu đổi hàng đã được duyệt",
            `Yêu cầu đổi hàng của bạn đã được duyệt. Đơn hàng mới #${newOrder._id.toString().slice(-6)} đã được tạo. Bạn sẽ thanh toán chênh lệch giá ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(totalPrice)} khi nhận hàng (COD).`,
            `/order-history`
          );

          // Thông báo cho admin/staff về đơn hàng mới từ exchange
          const staffUsers = await User.find({ role: { $in: ["admin", "seller", "staff"] } }).select("_id");
          await Promise.all(
            staffUsers.map((u) =>
              createNotification(
                u._id,
                "order_new",
                "Đơn hàng đổi mới (COD)",
                `Đơn hàng đổi mới #${newOrder._id.toString().slice(-6)} đã được tạo từ yêu cầu đổi hàng #${exchange._id.toString().slice(-6)}. Phương thức thanh toán: COD.`,
                `/admin/orders`
              )
            )
          );
        } catch (notifError) {
          console.error("Error creating notification:", notifError);
        }

        return res.status(200).json({
          success: true,
          message: "Yêu cầu đổi hàng đã được duyệt. Đơn hàng mới đã được tạo với phương thức COD.",
          data: populatedExchange,
          newOrder,
        });
      }

      // Nếu là PayOS và có chênh lệch giá nhưng chưa có PendingOrder (trường hợp hiếm, có thể do lỗi)
      // Tạo PendingOrder và PayOS payment link
      const taxPrice = Math.round(priceDifference * 0.1);
      const shippingPrice = 0;
      const totalPrice = priceDifference + taxPrice + shippingPrice;

      try {
        const payOSOrderCode = parseInt(Date.now().toString().slice(-9));
        const payOSItems = exchange.itemsToExchange.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: Math.round(i.price),
        }));
        // PayOS yêu cầu description tối đa 25 ký tự
        const shortDesc = `Đổi hàng #${exchange._id.toString().slice(-6)}`;
        
        const User = require("../models/User");
        const user = await User.findById(exchange.userId).select("email name");
        
        const paymentData = {
          orderId: payOSOrderCode.toString(),
          amount: Math.round(totalPrice),
          description: shortDesc,
          buyerName: exchange.shippingAddress.fullName,
          buyerEmail: user?.email || "",
          buyerPhone: exchange.shippingAddress.phone,
          buyerAddress: `${exchange.shippingAddress.address}, ${exchange.shippingAddress.city}`,
          items: payOSItems,
          returnUrl: `${process.env.FRONTEND_URL}/exchange-payment-success?exchangeId=${exchange._id}`,
          cancelUrl: `${process.env.FRONTEND_URL}/exchange-payment-failure?exchangeId=${exchange._id}`,
        };
        const paymentResult = await payOSService.createPaymentLink(paymentData);

        const pendingOrder = await PendingOrder.create({
          userId: exchange.userId,
          items: exchange.itemsToExchange,
          shippingAddress: exchange.shippingAddress,
          itemsPrice: priceDifference,
          taxPrice,
          shippingPrice,
          totalPrice,
          discountAmount: 0,
          discountApplied: false,
          payOSOrderCode: paymentResult.orderCode,
          payOSPaymentLinkId: paymentResult.data.paymentLinkId,
          payOSCheckoutUrl: paymentResult.data.checkoutUrl,
          payOSQrCode: paymentResult.data.qrCode,
          exchangeId: exchange._id,
        });

        exchange.status = "Approved";
        if (adminNotes) exchange.adminNotes = adminNotes;
        await exchange.save();

        const populatedExchange = await Exchange.findById(exchange._id)
          .populate("originalOrderId")
          .populate("userId", "name email")
          .populate("itemsToReturn.productId", "name image")
          .populate("itemsToExchange.productId", "name image");

        try {
          await Notification.create({
            userId: exchange.userId,
            type: "exchange_approved",
            title: "Yêu cầu đổi hàng đã được duyệt",
            message: `Yêu cầu đổi hàng của bạn đã được duyệt. Vui lòng thanh toán chênh lệch giá ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(totalPrice)} để hoàn tất đổi hàng.`,
            link: "/order-history",
            metadata: { exchangeId: exchange._id, pendingOrderId: pendingOrder._id },
          });
        } catch (notifError) {
          console.error("Error creating notification:", notifError);
        }

        return res.status(200).json({
          success: true,
          message: "Yêu cầu đổi hàng đã được duyệt. Vui lòng thanh toán chênh lệch giá để hoàn tất.",
          data: populatedExchange,
          payOS: {
            checkoutUrl: paymentResult.data.checkoutUrl,
            qrCode: paymentResult.data.qrCode,
            orderCode: paymentResult.orderCode,
          },
          pendingOrderId: pendingOrder._id,
          totalPrice,
        });
      } catch (payOSError) {
        console.error("❌ Lỗi tạo PayOS payment link:", payOSError);
        return res.status(500).json({
          success: false,
          message: `Tạo payment link thất bại: ${payOSError.message}`,
        });
      }
    }

    // Nếu reject hoặc các trạng thái khác
    if (status === "Rejected") {
      exchange.status = "Rejected";
      if (adminNotes) exchange.adminNotes = adminNotes;
      await exchange.save();

      const populatedExchange = await Exchange.findById(exchange._id)
        .populate("originalOrderId")
        .populate("newOrderId")
        .populate("userId", "name email")
        .populate("itemsToReturn.productId", "name image")
        .populate("itemsToExchange.productId", "name image");

      // Tạo thông báo cho user nếu bị từ chối
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

      return res.status(200).json({
        success: true,
        message: "Yêu cầu đổi hàng đã được từ chối",
        data: populatedExchange,
      });
    }

    // Các trạng thái khác (nếu có)
    exchange.status = status;
    if (adminNotes) exchange.adminNotes = adminNotes;
    await exchange.save();

    const populatedExchange = await Exchange.findById(exchange._id)
      .populate("originalOrderId")
      .populate("newOrderId")
      .populate("userId", "name email")
      .populate("itemsToReturn.productId", "name image")
      .populate("itemsToExchange.productId", "name image");

    return res.status(200).json({
      success: true,
      message: `Yêu cầu đổi hàng đã được cập nhật`,
      data: populatedExchange,
    });
  } catch (error) {
    console.error("❌ Error updating exchange status:", error);
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

// ==================== XỬ LÝ PAYOS CALLBACK CHO EXCHANGE ====================
exports.processExchangePayment = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const { status, update_time, email_address } = req.body;

    // Tìm PendingOrder theo exchangeId
    const pendingOrder = await PendingOrder.findOne({ exchangeId });
    
    if (!pendingOrder) {
      // Có thể order đã được tạo rồi, kiểm tra xem có Order nào với exchangeId không
      const existingOrder = await Order.findOne({
        "paymentResult.payOSData.orderCode": req.body.orderCode || pendingOrder?.payOSOrderCode,
      });
      
      if (existingOrder && existingOrder.isPaid) {
        const exchange = await Exchange.findById(exchangeId)
          .populate("originalOrderId")
          .populate("newOrderId")
          .populate("userId", "name email")
          .populate("itemsToReturn.productId", "name image")
          .populate("itemsToExchange.productId", "name image");
        
        return res.status(200).json({
          success: true,
          message: "Đơn hàng đổi đã được thanh toán trước đó",
          data: exchange,
        });
      }
      
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đổi hàng chờ thanh toán",
      });
    }

    // Tìm exchange
    const exchange = await Exchange.findById(exchangeId)
      .populate("originalOrderId")
      .populate("itemsToReturn.productId", "name image variants")
      .populate("itemsToExchange.productId", "name image variants");

    if (!exchange) {
      await PendingOrder.findByIdAndDelete(pendingOrder._id);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đổi hàng",
      });
    }

    // Kiểm tra lại tồn kho trước khi tạo order
    for (const item of exchange.itemsToExchange) {
      const product = await Product.findById(item.productId);
      if (!product) {
        await PendingOrder.findByIdAndDelete(pendingOrder._id);
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
        await PendingOrder.findByIdAndDelete(pendingOrder._id);
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ${product.name} không đủ số lượng`,
        });
      }
    }

    // Tạo Order từ PendingOrder
    const newOrder = await Order.create({
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
        status: status || "PAID",
        update_time: update_time || new Date(),
        email_address: email_address,
      },
      notes: `Đơn hàng đổi - Mã đơn gốc: #${exchange.originalOrderId._id.toString().slice(-6)}, Mã đơn mới: #${Date.now().toString().slice(-6)}. Chênh lệch giá: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(pendingOrder.itemsPrice)}`,
    });

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
        note: `Đổi hàng - Bán hàng mới cho đơn #${newOrder._id.toString().slice(-6)}`,
        stockAfter: product.countInStock,
        orderId: newOrder._id,
        exchangeId: exchange._id,
      });
    }

    // Cập nhật exchange với newOrderId và tự động approve
    exchange.newOrderId = newOrder._id;
    exchange.status = "Approved"; // Tự động approve sau khi thanh toán thành công
    await exchange.save();

    // Xóa PendingOrder sau khi đã tạo Order thành công
    await PendingOrder.findByIdAndDelete(pendingOrder._id);

    // Tạo thông báo cho user
    try {
      const { createNotification } = require("./notificationController");
      const User = require("../models/User");

      await createNotification(
        exchange.userId,
        "exchange_approved",
        "Đổi hàng đã hoàn tất",
        `Đơn hàng đổi #${newOrder._id.toString().slice(-6)} đã được thanh toán và tạo thành công.`,
        `/order-history`
      );

      // Thông báo cho seller/admin về đơn hàng đổi mới đã thanh toán
      const staffUsers = await User.find({ role: { $in: ["admin", "seller", "staff"] } }).select("_id");
      await Promise.all(
        staffUsers.map((u) =>
          createNotification(
            u._id,
            "order_new",
            "Đơn hàng đổi mới đã thanh toán",
            `Khách hàng đã thanh toán đơn hàng đổi #${newOrder._id.toString().slice(-6)} từ yêu cầu đổi hàng #${exchange._id.toString().slice(-6)}.`,
            `/admin/orders`
          )
        )
      );
    } catch (notifErr) {
      console.error("Error creating exchange payment notifications:", notifErr);
    }

    const populatedExchange = await Exchange.findById(exchange._id)
      .populate("originalOrderId")
      .populate("newOrderId")
      .populate("userId", "name email")
      .populate("itemsToReturn.productId", "name image")
      .populate("itemsToExchange.productId", "name image");

    res.status(200).json({
      success: true,
      message: "Thanh toán thành công và đơn hàng đổi đã được tạo",
      data: populatedExchange,
      newOrder,
    });
  } catch (error) {
    console.error("Error processing exchange payment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Không thể xử lý thanh toán đổi hàng",
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

