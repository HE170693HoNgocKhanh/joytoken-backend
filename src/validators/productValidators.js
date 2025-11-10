const { validateBody, validateParamsId } = require("../middleware/validate");

const createProductValidator = validateBody({
  name: {
    required: true,
    isLength: { min: 1, max: 200 },
  },
  description: {
    required: true,
    isLength: { min: 1, max: 5000 },
  },
  price: {
    required: true,
    isFloat: { min: 0 },
  },
  category: {
    required: true,
    isMongoId: true,
  },
  countInStock: {
    isInt: { min: 0 },
  },
});

const updateProductValidator = validateBody({
  name: {
    isLength: { min: 1, max: 200 },
  },
  description: {
    isLength: { min: 1, max: 5000 },
  },
  price: {
    isFloat: { min: 0 },
  },
  category: {
    isMongoId: true,
  },
  countInStock: {
    isInt: { min: 0 },
  },
});

const productIdParamValidator = validateParamsId("id");
const sellerIdParamValidator = validateParamsId("sellerId");

module.exports = {
  createProductValidator,
  updateProductValidator,
  productIdParamValidator,
  sellerIdParamValidator,
};

