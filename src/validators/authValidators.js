const { validateBody, validateParamsId } = require("../middleware/validate");

const registerValidator = validateBody({
  name: {
    required: true,
    isLength: { min: 2, max: 50 },
  },
  email: {
    required: true,
    isEmail: true,
  },
  password: {
    required: true,
    isStrongPassword: true,
  },
});

const loginValidator = validateBody({
  email: {
    required: true,
    isEmail: true,
  },
  password: {
    required: true,
  },
});

const verifyEmailValidator = validateBody({
  email: {
    required: true,
    isEmail: true,
  },
  otp: {
    required: true,
    matches: /^\d{6}$/,
  },
});

module.exports = {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
};

