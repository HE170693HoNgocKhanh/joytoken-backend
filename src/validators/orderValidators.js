const { validateBody, validateParamsId } = require("../middleware/validate");

const createOrderValidator = validateBody({
  items: {
    required: true,
    custom: (value, req) => {
      if (!Array.isArray(value) || value.length === 0) {
        return "Giỏ hàng không được để trống.";
      }
      for (const item of value) {
        if (!item.productId && !item.product) {
          return "Thiếu product.";
        }
        if (!item.quantity || item.quantity < 1) {
          return "Số lượng sản phẩm phải >= 1.";
        }
        if (!item.price || item.price < 0) {
          return "Giá sản phẩm không hợp lệ.";
        }
      }
      return null;
    },
  },
  shippingAddress: {
    required: true,
    custom: (value, req) => {
      if (!value || typeof value !== "object") {
        return "Địa chỉ giao hàng không hợp lệ.";
      }
      if (!value.fullName || !value.fullName.trim()) {
        return "Tên người nhận là bắt buộc.";
      }
      if (!value.phone || !value.phone.trim()) {
        return "Số điện thoại là bắt buộc.";
      }
      if (!value.address || !value.address.trim()) {
        return "Địa chỉ là bắt buộc.";
      }
      if (!value.city || !value.city.trim()) {
        return "Thành phố là bắt buộc.";
      }
      return null;
    },
  },
  paymentMethod: {
    required: true,
    isIn: ["COD", "PayOS"],
  },
  itemsPrice: {
    required: true,
    isFloat: { min: 0 },
  },
  taxPrice: {
    required: true,
    isFloat: { min: 0 },
  },
  shippingPrice: {
    required: true,
    isFloat: { min: 0 },
  },
});

const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];

const statusUpdateValidator = validateBody({
  status: {
    required: true,
    custom: (value, req) => {
      if (!value) return "Trạng thái không được để trống.";
      const normalized = String(value).trim().toLowerCase();
      if (!allowedStatuses.includes(normalized)) {
        return "Trạng thái không hợp lệ.";
      }
      const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      req.body.status = capitalized;
      req._normalizedStatus = normalized;
      return null;
    },
  },
  cancelReason: {
    custom: (value, req) => {
      const normalizedStatus = req._normalizedStatus;
      if (normalizedStatus === "cancelled") {
        if (!value || String(value).trim() === "") {
          return "Vui lòng nhập lý do hủy đơn hàng.";
        }
        if (String(value).trim().length > 500) {
          return "Lý do hủy đơn hàng tối đa 500 ký tự.";
        }
        req.body.cancelReason = String(value).trim();
        return null;
      }
      if (value) {
        req.body.cancelReason = String(value).trim();
      }
      return null;
    },
  },
});

const orderIdParamValidator = validateParamsId("id");

module.exports = {
  createOrderValidator,
  statusUpdateValidator,
  orderIdParamValidator,
};
