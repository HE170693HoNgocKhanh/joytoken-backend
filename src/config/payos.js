const { PayOS } = require("@payos/node");

// Khởi tạo PayOS với object config (v2.x)
const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

// Log để verify (có thể remove sau)
console.log("PayOS init:", {
  clientId: !!process.env.PAYOS_CLIENT_ID,
  hasApiKey: !!process.env.PAYOS_API_KEY,
  // Log thêm để check version/methods (optional, remove nếu không cần)
  hasPaymentRequests: !!payOS.paymentRequests,
});

module.exports = payOS;
