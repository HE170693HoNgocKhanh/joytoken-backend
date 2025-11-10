const { PayOS } = require("@payos/node");

// Khởi tạo PayOS với object config (v2.x)
const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

// Log để verify (chỉ hiển thị khi không phải production)
if (process.env.NODE_ENV !== "production") {
  console.log("PayOS init:", {
    clientId: !!process.env.PAYOS_CLIENT_ID,
    hasApiKey: !!process.env.PAYOS_API_KEY,
    // Log thêm để check version/methods (optional)
    hasPaymentRequests: !!payOS.paymentRequests,
  });
}

module.exports = payOS;
