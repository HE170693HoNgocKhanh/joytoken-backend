const Product = require("../models/Product");
const Category = require("../models/Category");

// Lấy tất cả products với phân trang và filter
exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { isActive: true };

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice)
        filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice)
        filter.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Sort
    let sort = {};
    if (req.query.sort) {
      const sortBy = req.query.sort;
      switch (sortBy) {
        case "price_asc":
          sort.price = 1;
          break;
        case "price_desc":
          sort.price = -1;
          break;
        case "name_asc":
          sort.name = 1;
          break;
        case "name_desc":
          sort.name = -1;
          break;
        case "rating":
          sort.rating = -1;
          break;
        default:
          sort.createdAt = -1;
      }
    } else {
      sort.createdAt = -1;
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy product theo ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name description")
      .populate("seller", "name email");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Tạo product mới
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      image,
      images,
      countInStock,
      variants,
      personalize,
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đủ thông tin bắt buộc",
      });
    }

    // Kiểm tra category tồn tại
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Danh mục không tồn tại",
      });
    }

    const product = await Product.create({
      name,
      description,
      price,
      category,
      image,
      images,
      countInStock: countInStock || 0,
      variants,
      personalize: personalize || false,
      seller: req.user.id, // Từ middleware auth
    });

    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name")
      .populate("seller", "name email");

    res.status(201).json({
      success: true,
      message: "Tạo sản phẩm thành công",
      data: populatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // 🔹 Kiểm tra quyền sở hữu (chỉ seller hoặc admin)
    const sellerId = product.seller ? product.seller.toString() : null;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (sellerId && sellerId !== userId && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa sản phẩm này",
      });
    }

    const {
      name,
      description,
      price,
      category,
      image,
      images,
      countInStock,
      variants,
      personalize,
      isActive,
    } = req.body;

    // 🔹 Kiểm tra category nếu có thay đổi
    const currentCategory = product.category
      ? product.category.toString()
      : null;
    if (category && category !== currentCategory) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Danh mục không tồn tại",
        });
      }
    }

    // 🔹 Cập nhật
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        category,
        image,
        images,
        countInStock,
        variants,
        personalize,
        isActive,
      },
      { new: true, runValidators: true }
    )
      .populate("category", "name")
      .populate("seller", "name email");

    return res.status(200).json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("🔥 Error in updateProduct:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Xóa product (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // 🔍 Debug log để xem giá trị thực tế
    console.log("🧩 DEBUG: product.seller =", product.seller);
    console.log("🧩 DEBUG: req.user =", req.user);

    const sellerId = product.seller ? product.seller.toString() : null;
    const userId = req.user?.id;
    const role = req.user?.role;

    // 🔒 Chỉ cho phép chủ sản phẩm hoặc admin
    if (sellerId && sellerId !== userId && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa sản phẩm này",
      });
    }

    // ⚡ Nếu product không có seller (hàng cũ hoặc admin tạo)
    if (!sellerId && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Sản phẩm không xác định người bán, chỉ admin có thể xóa",
      });
    }

    await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Xóa sản phẩm thành công",
    });
  } catch (error) {
    console.error("🔥 DELETE PRODUCT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Lấy products theo seller
exports.getProductsBySeller = async (req, res) => {
  try {
    const sellerId = req.params.sellerId || req.user.id;

    const products = await Product.find({ seller: sellerId })
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.categoryId })
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
