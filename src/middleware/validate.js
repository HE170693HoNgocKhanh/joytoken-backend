const { isEmail, isStrongPassword, isUUID, isMongoId, isInt, isFloat, isLength, isIn, isISO8601, matches } = require("validator");

function buildError(field, message) {
	return { field, message };
}

function getValue(obj, path) {
	return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

// Simple schema-driven validator using 'validator' package
// Rules supported per field:
// - required: boolean
// - isEmail, isStrongPassword, isMongoId, isUUID
// - isInt: { min, max }
// - isFloat: { min, max }
// - isLength: { min, max }
// - isIn: string[]
// - isISO8601: boolean
// - matches: regex string or RegExp
// - custom: (value, req) => string | null  (return error message or null)
function validateBody(schema) {
	return (req, res, next) => {
		const errors = [];
		for (const [fieldPath, rules] of Object.entries(schema)) {
			const rawValue = getValue(req.body, fieldPath);
			const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;

			if (rules.required && (value === undefined || value === null || value === "")) {
				errors.push(buildError(fieldPath, "Trường này là bắt buộc."));
				continue;
			}
			if (value === undefined || value === null || value === "") continue;

			try {
				if (rules.isEmail && !isEmail(String(value))) {
					errors.push(buildError(fieldPath, "Email không hợp lệ."));
				}
				if (rules.isStrongPassword) {
					const password = String(value);
					const hasMinLength = password.length >= 8;
					const hasNumber = /[0-9]/.test(password);
					const hasLowercase = /[a-z]/.test(password);
					const hasUppercase = /[A-Z]/.test(password);
					const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
					
					if (!hasMinLength || !hasNumber || !hasLowercase || !hasUppercase || !hasSpecialChar) {
						errors.push(buildError(fieldPath, "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt."));
					}
				}
				if (rules.isMongoId && !isMongoId(String(value))) {
					errors.push(buildError(fieldPath, "ID không hợp lệ."));
				}
				if (rules.isUUID && !isUUID(String(value))) {
					errors.push(buildError(fieldPath, "UUID không hợp lệ."));
				}
				if (rules.isInt) {
					const ok = isInt(String(value), rules.isInt === true ? {} : rules.isInt);
					if (!ok) errors.push(buildError(fieldPath, "Giá trị phải là số nguyên hợp lệ."));
				}
				if (rules.isFloat) {
					const ok = isFloat(String(value), rules.isFloat === true ? {} : rules.isFloat);
					if (!ok) errors.push(buildError(fieldPath, "Giá trị phải là số thực hợp lệ."));
				}
				if (rules.isLength) {
					const ok = isLength(String(value), rules.isLength);
					if (!ok) errors.push(buildError(fieldPath, `Độ dài không hợp lệ.`));
				}
				if (rules.isIn && Array.isArray(rules.isIn) && !rules.isIn.includes(value)) {
					errors.push(buildError(fieldPath, `Giá trị phải thuộc: ${rules.isIn.join(", ")}`));
				}
				if (rules.isISO8601 && !isISO8601(String(value))) {
					errors.push(buildError(fieldPath, "Ngày tháng không hợp lệ."));
				}
				if (rules.matches) {
					const regex = rules.matches instanceof RegExp ? rules.matches : new RegExp(rules.matches);
					if (!matches(String(value), regex)) {
						errors.push(buildError(fieldPath, "Định dạng không hợp lệ."));
					}
				}
				if (typeof rules.custom === "function") {
					const msg = rules.custom(value, req);
					if (typeof msg === "string" && msg) {
						errors.push(buildError(fieldPath, msg));
					}
				}
			} catch (e) {
				errors.push(buildError(fieldPath, "Giá trị không hợp lệ."));
			}
		}

		if (errors.length > 0) {
			return res.status(400).json({ success: false, errors });
		}
		next();
	};
}

function validateParamsId(paramName = "id") {
	return (req, res, next) => {
		const id = req.params[paramName];
		if (!id || !isMongoId(String(id))) {
			return res.status(400).json({ success: false, message: `Tham số ${paramName} không hợp lệ.` });
		}
		next();
	};
}

module.exports = { validateBody, validateParamsId };


