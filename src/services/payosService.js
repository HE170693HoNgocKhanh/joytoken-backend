const payOS = require("../config/payos");
const Order = require("../models/Order");

class PayOSService {
  /**
   * Tạo payment link PayOS
   * @param {Object} orderData - Dữ liệu đơn hàng
   * @returns {Object} - Payment link info
   */
  async createPaymentLink(orderData) {
    try {
      const { orderId, amount, description, returnUrl, cancelUrl } = orderData;

      // Tạo order code unique (timestamp + random)
      const orderCode = parseInt(Date.now().toString().slice(-9));

      const paymentData = {
        orderCode: orderCode,
        amount: Math.round(amount), // PayOS yêu cầu số nguyên
        description: description || `Thanh toán đơn hàng ${orderId}`,
        buyerName: orderData.buyerName || "Khách hàng",
        buyerEmail: orderData.buyerEmail || "",
        buyerPhone: orderData.buyerPhone || "",
        buyerAddress: orderData.buyerAddress || "",
        items: orderData.items || [],
        returnUrl: returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
        cancelUrl: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
        signature: orderData.signature,
      };

      // Tạo payment link
      const paymentLinkResponse = await payOS.createPaymentLink(paymentData);

      // Cập nhật order với thông tin PayOS
      await Order.findByIdAndUpdate(orderId, {
        "paymentResult.provider": "PayOS",
        "paymentResult.payOSData.orderCode": orderCode,
        "paymentResult.payOSData.paymentLinkId": paymentLinkResponse.paymentLinkId,
        "paymentResult.payOSData.checkoutUrl": paymentLinkResponse.checkoutUrl,
        "paymentResult.payOSData.qrCode": paymentLinkResponse.qrCode,
      });

      return {
        success: true,
        data: paymentLinkResponse,
        orderCode: orderCode,
      };
    } catch (error) {
      console.error("PayOS create payment link error:", error);
      throw new Error(`Tạo payment link thất bại: ${error.message}`);
    }
  }

  /**
   * Xác nhận thanh toán từ webhook
   * @param {Object} webhookData - Dữ liệu từ PayOS webhook
   * @returns {Object} - Kết quả xác nhận
   */
  async confirmPayment(webhookData) {
    try {
      const { orderCode, amount, description, accountNumber, reference, transactionDateTime, virtualAccountName, virtualAccountNumber } = webhookData;

      // Tìm order theo orderCode
      const order = await Order.findOne({
        "paymentResult.payOSData.orderCode": orderCode,
      });

      if (!order) {
        throw new Error(`Không tìm thấy đơn hàng với orderCode: ${orderCode}`);
      }

      // Kiểm tra số tiền
      if (Math.round(order.totalPrice) !== amount) {
        throw new Error(`Số tiền không khớp. Expected: ${order.totalPrice}, Received: ${amount}`);
      }

      // Cập nhật trạng thái thanh toán
      order.isPaid = true;
      order.paidAt = new Date(transactionDateTime);
      order.paymentResult.status = "PAID";
      order.paymentResult.transactionId = reference;
      order.paymentResult.paidAt = new Date(transactionDateTime);
      
      await order.save();

      return {
        success: true,
        message: "Thanh toán thành công",
        order: order,
      };
    } catch (error) {
      console.error("PayOS confirm payment error:", error);
      throw new Error(`Xác nhận thanh toán thất bại: ${error.message}`);
    }
  }

  /**
   * Hủy payment link
   * @param {Number} orderCode - Mã đơn hàng PayOS
   * @returns {Object} - Kết quả hủy
   */
  async cancelPaymentLink(orderCode) {
    try {
      const result = await payOS.cancelPaymentLink(orderCode);
      
      // Cập nhật order status
      await Order.findOneAndUpdate(
        { "paymentResult.payOSData.orderCode": orderCode },
        { 
          status: "Cancelled",
          "paymentResult.status": "CANCELLED" 
        }
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("PayOS cancel payment link error:", error);
      throw new Error(`Hủy payment link thất bại: ${error.message}`);
    }
  }

  /**
   * Lấy thông tin payment link
   * @param {Number} orderCode - Mã đơn hàng PayOS
   * @returns {Object} - Thông tin payment link
   */
  async getPaymentLinkInformation(orderCode) {
    try {
      const result = await payOS.getPaymentLinkInformation(orderCode);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("PayOS get payment link info error:", error);
      throw new Error(`Lấy thông tin payment link thất bại: ${error.message}`);
    }
  }

  /**
   * Xác thực webhook signature
   * @param {Object} webhookBody - Body của webhook
   * @param {String} signature - Signature từ header
   * @returns {Boolean} - Kết quả xác thực
   */
  verifyWebhookSignature(webhookBody, signature) {
    try {
      return payOS.verifyPaymentWebhookData(webhookBody, signature);
    } catch (error) {
      console.error("PayOS verify webhook signature error:", error);
      return false;
    }
  }
}

module.exports = new PayOSService();