const { validateBody, validateParamsId } = require("../middleware/validate");

const updateProfileValidator = validateBody({
  name: {
    required: true,
    isLength: { min: 2, max: 50 },
  },
  phone: {
    matches: /^[0-9]{10,11}$/,
  },
  address: {
    isLength: { min: 5, max: 200 },
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

