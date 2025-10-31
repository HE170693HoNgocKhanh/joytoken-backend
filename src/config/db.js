const mongoose = require("mongoose");

async function connect() {
  try {
    await mongoose.connect(process.env.DB_CONNECT, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ Connected to database: ${mongoose.connection.name}`);
    console.log(`📦 Collections:`, Object.keys(mongoose.connection.collections));
    console.log(`✅ Connect successfully to database`);
  } catch (error) {
    console.error("❌ Connect failure:", error.message);
  }
}

module.exports = { connect };
