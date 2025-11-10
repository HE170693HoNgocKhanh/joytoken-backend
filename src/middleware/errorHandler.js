function notFound(req, res, next) {
	res.status(404).json({ success: false, message: "Không tìm thấy tài nguyên." });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
	const status = err.status || 500;
	const isProd = process.env.NODE_ENV === "production";
	const message = status >= 500 ? "Lỗi hệ thống. Vui lòng thử lại sau." : err.message || "Yêu cầu không hợp lệ.";

	if (!isProd) {
		// Detailed logs in non-production
		// Avoid logging sensitive data from req
		console.error("Error:", {
			status,
			message: err.message,
			stack: err.stack,
		});
	}

	res.status(status).json({
		success: false,
		message,
		...(isProd ? {} : { details: err.message }),
	});
}

module.exports = { notFound, errorHandler };


