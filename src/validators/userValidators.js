const { validateBody, validateParamsId } = require("../middleware/validate");

const updateProfileValidator = validateBody({
  name: {
    required: true,
    isLength: { min: 2, max: 50 },
  },
  phone: {
    custom: (value) => {
      // Phone là optional, nhưng nếu có thì phải đúng format
      if (value !== undefined && value !== null && value !== "") {
        const phoneRegex = /^[0-9]{10,11}$/;
        if (!phoneRegex.test(value.trim())) {
          return "Số điện thoại phải có 10-11 chữ số";
        }
      }
      return null;
    },
  },
  address: {
    custom: (value) => {
      // Address là optional, nhưng nếu có thì phải có độ dài hợp lệ
      if (value !== undefined && value !== null && value !== "") {
        const trimmed = value.trim();
        if (trimmed.length < 5) {
          return "Địa chỉ phải có ít nhất 5 ký tự";
        }
        if (trimmed.length > 200) {
          return "Địa chỉ không được vượt quá 200 ký tự";
        }
      }
      return null;
    },
  },
});

const changeEmailRequestValidator = validateBody({
  newEmail: {
    required: true,
    isEmail: true,
  },
});

const verifyEmailOtpValidator = validateBody({
  otp: {
    required: true,
    matches: /^\d{6}$/,
  },
});

const updateByAdminValidator = validateBody({
  role: {
    isIn: ["customer", "seller", "staff", "admin"],
  },
  emailVerified: {
    custom: (value) => {
      if (value !== undefined && typeof value !== "boolean") {
        return "emailVerified phải là boolean";
      }
      return null;
    },
  },
});

const userIdParamValidator = validateParamsId("id");
const productIdParamValidator = validateParamsId("productId");

module.exports = {
  updateProfileValidator,
  changeEmailRequestValidator,
  verifyEmailOtpValidator,
  updateByAdminValidator,
  userIdParamValidator,
  productIdParamValidator,
};

