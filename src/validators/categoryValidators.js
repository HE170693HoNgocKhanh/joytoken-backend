const { validateBody, validateParamsId } = require("../middleware/validate");

const createCategoryValidator = validateBody({
  name: {
    required: true,
    isLength: { min: 1, max: 100 },
  },
  description: {
    isLength: { min: 0, max: 1000 },
  },
});

const updateCategoryValidator = validateBody({
  name: {
    isLength: { min: 1, max: 100 },
  },
  description: {
    isLength: { min: 0, max: 1000 },
  },
});

const categoryIdParamValidator = validateParamsId("id");

module.exports = {
  createCategoryValidator,
  updateCategoryValidator,
  categoryIdParamValidator,
};

