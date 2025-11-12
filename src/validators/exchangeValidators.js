const { validateBody, validateParamsId } = require("../middleware/validate");

const createExchangeValidator = validateBody({
  originalOrderId: {
    required: true,
    isMongoId: true,
  },
  itemsToReturn: {
    required: true,
    custom: (value, req) => {
      if (!Array.isArray(value) || value.length === 0) {
        return "Danh sách sản phẩm trả lại không được để trống.";
      }
      for (const item of value) {
        if (!item.productId && !item.product) {
          return "Thiếu productId trong sản phẩm trả lại.";
        }
        if (!item.quantity || item.quantity < 1) {
          return "Số lượng sản phẩm trả lại phải >= 1.";
        }
      }
      return null;
    },
  },
  itemsToExchange: {
    custom: (value, req) => {
      if (value && Array.isArray(value) && value.length > 0) {
        for (const item of value) {
          if (!item.productId && !item.product) {
            return "Thiếu productId trong sản phẩm muốn đổi.";
          }
          if (!item.quantity || item.quantity < 1) {
            return "Số lượng sản phẩm muốn đổi phải >= 1.";
          }
        }
      }
      return null;
    },
  },
  reason: {
    required: true,
    isLength: { min: 10, max: 500 },
  },
  paymentMethod: {
    isIn: ["COD", "PayOS"],
  },
});

const updateExchangeStatusValidator = validateBody({
  status: {
    required: true,
    isIn: ["Pending", "Approved", "Rejected", "Completed", "Cancelled"],
  },
  adminNote: {
    isLength: { min: 0, max: 500 },
  },
});

const exchangeIdParamValidator = validateParamsId("id");

module.exports = {
  createExchangeValidator,
  updateExchangeStatusValidator,
  exchangeIdParamValidator,
};

