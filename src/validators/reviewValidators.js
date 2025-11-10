const { validateBody, validateParamsId } = require("../middleware/validate");

const createReviewValidator = validateBody({
  productId: {
    required: true,
    isMongoId: true,
  },
  rating: {
    required: true,
    isInt: { min: 1, max: 5 },
  },
  comment: {
    required: true,
    isLength: { min: 1, max: 1000 },
  },
});

const updateReviewValidator = validateBody({
  rating: {
    isInt: { min: 1, max: 5 },
  },
  comment: {
    isLength: { min: 1, max: 1000 },
  },
});

const reviewIdParamValidator = validateParamsId("id");
const productIdParamValidator = validateParamsId("productId");

module.exports = {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator,
  productIdParamValidator,
};

