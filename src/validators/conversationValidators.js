const { validateParamsId } = require("../middleware/validate");

const conversationIdParamValidator = validateParamsId("id");

module.exports = {
  conversationIdParamValidator,
};

