const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  password: { type: String, required: true },
  phone: { type: String },
  phoneVerified: { type: Boolean, default: false },
  address: { type: String },
  role: { 
    type: String, 
    enum: ['customer', 'seller', 'staff', 'admin'], 
    default: 'customer' 
  },

  tempEmail: { type: String }, // email tạm chờ xác nhận
  emailOtp: { type: String },  // mã OTP gửi đến email mới
  emailOtpExpires: { type: Date } // thời hạn OTP

}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
