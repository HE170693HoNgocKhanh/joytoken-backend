const { PayOS } = require("@payos/node");

// Khởi tạo PayOS với thông tin từ environment variables
const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

module.exports = payOS;