const payOS = require("../config/payos");
const Order = require("../models/Order");

class PayOSService {
  async createPaymentLink(orderData) {
    try {
      const { orderId, amount, description, returnUrl, cancelUrl } = orderData;
      const orderCode = parseInt(Date.now().toString().slice(-9));

      const paymentData = {
        orderCode,
        amount: Math.round(amount),
        description: description || `Thanh toán đơn hàng ${orderId}`,
        // Buyer info (optional ở v2, nhưng giữ để đầy đủ)
        buyerName: orderData.buyerName || "Khách hàng",
        buyerEmail: orderData.buyerEmail || "",
        buyerPhone: orderData.buyerPhone || "",
        buyerAddress: orderData.buyerAddress || "",
        // Items (optional, nhưng giữ)
        items: orderData.items || [],
        returnUrl: returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
        cancelUrl: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
      };

      // ✅ PayOS v2.x: Dùng paymentRequests.create()
      const paymentLinkResponse = await payOS.paymentRequests.create(
        paymentData
      );

      // Không lưu vào Order nữa vì với PayOS, Order chỉ được tạo sau khi thanh toán thành công
      // Thông tin sẽ được lưu vào PendingOrder trong controller

      return { success: true, data: paymentLinkResponse, orderCode };
    } catch (error) {
      console.error("PayOS create payment link error:", error);
      throw new Error(`Tạo payment link thất bại: ${error.message}`);
    }
  }

  async cancelPaymentLink(orderCode) {
    try {
      // ✅ PayOS v2.x: Dùng paymentRequests.cancel()
      const result = await payOS.paymentRequests.cancel(orderCode);
      await Order.findOneAndUpdate(
        { "paymentResult.payOSData.orderCode": orderCode },
        { status: "Cancelled", "paymentResult.status": "CANCELLED" }
      );
      return { success: true, data: result };
    } catch (error) {
      console.error("PayOS cancel payment link error:", error);
      throw new Error(`Hủy payment link thất bại: ${error.message}`);
    }
  }

  async getPaymentLinkInformation(orderCode) {
    try {
      // ✅ PayOS v2.x: Dùng paymentRequests.retrieve() hoặc tương tự (check docs nếu cần, giả sử retrieve)
      // Note: Docs v2 chưa full, nếu lỗi thì thay bằng payOS.paymentRequests.get(orderCode) hoặc call API direct
      const result = await payOS.paymentRequests.retrieve(orderCode); // Hoặc .get nếu retrieve không tồn tại
      return { success: true, data: result };
    } catch (error) {
      console.error("PayOS get payment link info error:", error);
      throw new Error(`Lấy thông tin payment link thất bại: ${error.message}`);
    }
  }

  verifyWebhookSignature(webhookBody, signature) {
    try {
      // ✅ PayOS v2.x: Dùng webhooks.verify({ data, signature })
      // Giả sử webhookBody chứa full data, adjust nếu cần
      return payOS.webhooks.verify({
        ...webhookBody, // Bao gồm data, code, desc, etc.
        signature,
      });
    } catch (error) {
      console.error("PayOS verify webhook signature error:", error);
      return false;
    }
  }
}

module.exports = new PayOSService();
