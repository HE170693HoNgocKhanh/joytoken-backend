const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

// Tạo review mới
exports.createReview = async (req, res) => {
  try {
    const { productId, rating, comment, images } = req.body;

    if (!productId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đủ thông tin đánh giá"
      });
    }

    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại"
      });
    }

    // Kiểm tra user đã mua sản phẩm chưa
    const hasPurchased = await Order.findOne({
      userId: req.user.id,
      'items.productId': productId,
      status: 'Delivered'
    });

    if (!hasPurchased) {
      return res.status(400).json({
        success: false,
        message: "Bạn chỉ có thể đánh giá sản phẩm đã mua"
      });
    }

    // Kiểm tra user đã review sản phẩm này chưa
    const existingReview = await Review.findOne({
      productId,
      userId: req.user.id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này rồi"
      });
    }

    // Tạo review
    const review = await Review.create({
      productId,
      userId: req.user.id,
      userName: req.user.name,
      rating,
      comment,
      images: images || []
    });

    // Cập nhật rating và numReviews cho product
    const reviews = await Review.find({ productId });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / reviews.length;

    await Product.findByIdAndUpdate(productId, {
      rating: avgRating,
      numReviews: reviews.length
    });

    const populatedReview = await Review.findById(review._id)
      .populate('userId', 'name')
      .populate('productId', 'name image');

    res.status(201).json({
      success: true,
      message: "Đánh giá thành công",
      data: populatedReview
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này rồi"
      });
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy reviews của một sản phẩm
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filter by rating if provided
    const filter = { productId };
    if (req.query.rating) {
      filter.rating = parseInt(req.query.rating);
    }

    const reviews = await Review.find(filter)
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(filter);

    // Tính toán thống kê rating
    const ratingStats = await Review.aggregate([
      { $match: { productId: require('mongoose').Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      ratingStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy reviews của user hiện tại
exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id })
      .populate('productId', 'name image price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật review
exports.updateReview = async (req, res) => {
  try {
    const { rating, comment, images } = req.body;

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá"
      });
    }

    // Kiểm tra quyền sở hữu
    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa đánh giá này"
      });
    }

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { rating, comment, images },
      { new: true, runValidators: true }
    ).populate('productId', 'name image');

    // Cập nhật lại rating của product
    const reviews = await Review.find({ productId: review.productId });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / reviews.length;

    await Product.findByIdAndUpdate(review.productId, {
      rating: avgRating,
      numReviews: reviews.length
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật đánh giá thành công",
      data: updatedReview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Xóa review
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá"
      });
    }

    // Kiểm tra quyền (user sở hữu hoặc admin)
    if (review.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa đánh giá này"
      });
    }

    await Review.findByIdAndDelete(req.params.id);

    // Cập nhật lại rating của product
    const reviews = await Review.find({ productId: review.productId });
    let avgRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      avgRating = totalRating / reviews.length;
    }

    await Product.findByIdAndUpdate(review.productId, {
      rating: avgRating,
      numReviews: reviews.length
    });

    res.status(200).json({
      success: true,
      message: "Xóa đánh giá thành công"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy tất cả reviews (cho admin)
exports.getAllReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find()
      .populate('userId', 'name email')
      .populate('productId', 'name image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments();

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify review (cho admin)
exports.verifyReview = async (req, res) => {
  try {
    const { isVerified } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isVerified },
      { new: true }
    ).populate('userId', 'name').populate('productId', 'name');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá"
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái xác minh thành công",
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};