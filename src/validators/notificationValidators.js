const { validateParamsId } = require("../middleware/validate");

const notificationIdParamValidator = validateParamsId("id");

module.exports = {
  notificationIdParamValidator,
};

