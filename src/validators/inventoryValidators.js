const { validateBody, validateParamsId } = require("../middleware/validate");

const importStockValidator = validateBody({
  productId: {
    required: true,
    isMongoId: true,
  },
  variantId: {
    isMongoId: true,
  },
  quantity: {
    required: true,
    isInt: { min: 1, max: 500 },
  },
  note: {
    isLength: { min: 0, max: 500 },
  },
});

const exportStockValidator = validateBody({
  productId: {
    required: true,
    isMongoId: true,
  },
  variantId: {
    isMongoId: true,
  },
  quantity: {
    required: true,
    isInt: { min: 1 },
  },
  note: {
    isLength: { min: 0, max: 500 },
  },
});

const productIdParamValidator = validateParamsId("productId");

module.exports = {
  importStockValidator,
  exportStockValidator,
  productIdParamValidator,
};

