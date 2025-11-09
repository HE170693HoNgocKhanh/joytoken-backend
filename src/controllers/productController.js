const Product = require("../models/Product");
const Category = require("../models/Category");
const cloudinary = require("../config/cloudinary");

// 🧩 Helper: upload 1 hoặc nhiều ảnh lên Cloudinary
const uploadToCloudinary = async (files) => {
  const uploaded = [];
  for (const file of files) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "products",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });
    uploaded.push(result.secure_url);
  }
  return uploaded;
};

// ========================
// 📦 GET ALL PRODUCTS
// ========================
exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };

    if (req.query.category) filter.category = req.query.category;

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

    let sort = {};
    switch (req.query.sort) {
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

    const products = await Product.find(filter)
      .populate("category", "name")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// 🔍 GET PRODUCT BY ID
// ========================
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name description")
      .populate("seller", "name email");

    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// ➕ CREATE PRODUCT
// ========================
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, category, countInStock } = req.body;

    if (!name || !description || !price || !category)
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đủ thông tin bắt buộc",
      });

    const categoryExists = await Category.findById(category);
    if (!categoryExists)
      return res
        .status(400)
        .json({ success: false, message: "Danh mục không tồn tại" });

    let variants = [];
    if (req.body.variants) {
      if (Array.isArray(req.body.variants)) {
        variants = req.body.variants.map((v) => JSON.parse(v));
      } else {
        variants = [JSON.parse(req.body.variants)];
      }
    }

    // Parse events (đã gộp tags vào) - LUÔN parse, kể cả mảng rỗng
    console.log("📦 CREATE PRODUCT - Raw body events:", req.body.events);

    let events = [];
    if (req.body.events !== undefined) {
      try {
        events =
          typeof req.body.events === "string"
            ? JSON.parse(req.body.events)
            : req.body.events || [];
        if (!Array.isArray(events)) events = [];
      } catch (e) {
        console.error("Error parsing events:", e);
        events = [];
      }
    }
    console.log("✅ Parsed events (đã gộp tags):", events);

    // Parse flags - xử lý cả string "true"/"false" và boolean
    console.log("📦 CREATE PRODUCT - Raw body flags:", {
      isBestSeller: req.body.isBestSeller,
      isNew: req.body.isNew,
      isBackInStock: req.body.isBackInStock,
      label: req.body.label,
    });

    const isBestSeller =
      req.body.isBestSeller !== undefined
        ? req.body.isBestSeller === "true" || req.body.isBestSeller === true
        : false;
    const isNew =
      req.body.isNew !== undefined
        ? req.body.isNew === "true" || req.body.isNew === true
        : false;
    const isBackInStock =
      req.body.isBackInStock !== undefined
        ? req.body.isBackInStock === "true" || req.body.isBackInStock === true
        : false;
    const label =
      req.body.label && req.body.label.trim() !== "" ? req.body.label : null;

    console.log("✅ Parsed flags:", {
      isBestSeller,
      isNew,
      isBackInStock,
      label,
    });

    // 📸 Upload ảnh (nếu có)
    let image = null;
    let images = [];
    if (req.files) {
      if (req.files.image) {
        const uploadedMain = await uploadToCloudinary(req.files.image);
        image = uploadedMain[0];
      }
      if (req.files.images) {
        const uploadedList = await uploadToCloudinary(req.files.images);
        images = uploadedList;
      }
    }

    // 🔹 Tạo sản phẩm
    const productData = {
      name,
      description,
      price,
      category,
      image,
      images,
      countInStock: countInStock || 0,
      variants,
      personalize: false,
      seller: req.user.id,
      events: events,
      tags: [], // Không dùng tags nữa, đã gộp vào events
      isBestSeller: isBestSeller,
      isNew: isNew,
      isBackInStock: isBackInStock,
      label: label,
    };

    console.log("💾 Saving product with data:", {
      events: productData.events,
      isBestSeller: productData.isBestSeller,
      isNew: productData.isNew,
      isBackInStock: productData.isBackInStock,
      label: productData.label,
    });

    const product = await Product.create(productData);

    console.log("✅ Product created successfully:", {
      _id: product._id,
      events: product.events,
      isBestSeller: product.isBestSeller,
      isNew: product.isNew,
      isBackInStock: product.isBackInStock,
      label: product.label,
    });

    // 🔹 Tạo record Inventory cho product (import)
    const Inventory = require("../models/Inventory");

    // Nếu product có variants, tạo record import cho từng variant
    if (variants.length > 0) {
      for (const v of variants) {
        const qty = v.countInStock || 0;
        if (qty > 0) {
          await Inventory.create({
            productId: product._id,
            variant: { _id: v._id, size: v.size, color: v.color },
            type: "import",
            quantity: qty,
            note: "Nhập kho khi tạo sản phẩm",
            date: new Date(),
            stockAfter: qty,
            orderId: null,
          });
        }
      }
    } else {
      // Nếu không có variant, tạo 1 record import tổng
      const qty = countInStock || 0;
      if (qty > 0) {
        await Inventory.create({
          productId: product._id,
          type: "import",
          quantity: qty,
          note: "Nhập kho khi tạo sản phẩm",
          date: new Date(),
          stockAfter: qty,
          orderId: null,
        });
      }
    }

    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name")
      .populate("seller", "name email");

    res.status(201).json({
      success: true,
      message: "Tạo sản phẩm thành công và nhập kho",
      data: populatedProduct,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// ✏️ UPDATE PRODUCT
// ========================
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });

    const sellerId = product.seller?.toString();
    const userId = req.user?.id;
    const role = req.user?.role;
    if (
      sellerId &&
      sellerId !== userId &&
      role !== "admin" &&
      role !== "seller"
    )
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa sản phẩm này",
      });

    const {
      name,
      description,
      price,
      category,
      countInStock,
      personalize,
      isActive,
    } = req.body;

    // 🔍 Check category nếu đổi
    if (category && category !== product.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists)
        return res
          .status(400)
          .json({ success: false, message: "Danh mục không tồn tại" });
    }

    // 🔧 Parse variants
    let variants = product.variants || [];
    if (req.body.variants) {
      if (Array.isArray(req.body.variants)) {
        variants = req.body.variants.map((v) => JSON.parse(v));
      } else {
        variants = [JSON.parse(req.body.variants)];
      }
    }

    // Parse events (đã gộp tags vào) - LUÔN parse, kể cả mảng rỗng
    console.log("📦 UPDATE PRODUCT - Raw body events:", req.body.events);
    console.log("📦 UPDATE PRODUCT - Current product events:", product.events);

    // Gộp tags cũ vào events nếu có
    let currentEvents = [...(product.events || []), ...(product.tags || [])];

    let events = currentEvents;
    if (req.body.events !== undefined) {
      try {
        events =
          typeof req.body.events === "string"
            ? JSON.parse(req.body.events)
            : req.body.events || [];
        if (!Array.isArray(events)) events = [];
      } catch (e) {
        console.error("Error parsing events:", e);
        events = [];
      }
    }
    console.log("✅ Parsed events (đã gộp tags):", events);

    // Parse flags - xử lý cả string "true"/"false" và boolean
    console.log("📦 UPDATE PRODUCT - Raw body flags:", {
      isBestSeller: req.body.isBestSeller,
      isNew: req.body.isNew,
      isBackInStock: req.body.isBackInStock,
      label: req.body.label,
    });

    const isBestSeller =
      req.body.isBestSeller !== undefined
        ? req.body.isBestSeller === "true" || req.body.isBestSeller === true
        : product.isBestSeller || false;
    const isNew =
      req.body.isNew !== undefined
        ? req.body.isNew === "true" || req.body.isNew === true
        : product.isNew || false;
    const isBackInStock =
      req.body.isBackInStock !== undefined
        ? req.body.isBackInStock === "true" || req.body.isBackInStock === true
        : product.isBackInStock || false;
    const label =
      req.body.label !== undefined
        ? req.body.label && req.body.label.trim() !== ""
          ? req.body.label
          : null
        : product.label;

    console.log("✅ Parsed flags:", {
      isBestSeller,
      isNew,
      isBackInStock,
      label,
    });

    // 📸 Upload ảnh mới (nếu có)
    let image = product.image;
    let images = product.images || [];

    if (req.files) {
      if (req.files.image && req.files.image.length > 0) {
        const uploadedMain = await uploadToCloudinary(req.files.image);
        image = uploadedMain[0]; // thay ảnh chính
      }
      if (req.files.images && req.files.images.length > 0) {
        const uploadedList = await uploadToCloudinary(req.files.images);
        images = [...images, ...uploadedList]; // giữ ảnh cũ, thêm ảnh mới
      }
    }

    const updateData = {
      name,
      description,
      price,
      category,
      image,
      images,
      countInStock, // FE đã gửi tổng số lượng
      variants,
      personalize,
      isActive,
      events: events,
      tags: [], // Không dùng tags nữa, đã gộp vào events
      isBestSeller: isBestSeller,
      isNew: isNew,
      isBackInStock: isBackInStock,
      label: label,
    };

    console.log("💾 Updating product with data:", {
      events: updateData.events,
      isBestSeller: updateData.isBestSeller,
      isNew: updateData.isNew,
      isBackInStock: updateData.isBackInStock,
      label: updateData.label,
    });

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("category", "name")
      .populate("seller", "name email");

    console.log("✅ Product updated successfully:", {
      _id: updatedProduct._id,
      events: updatedProduct.events,
      isBestSeller: updatedProduct.isBestSeller,
      isNew: updatedProduct.isNew,
      isBackInStock: updatedProduct.isBackInStock,
      label: updatedProduct.label,
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// 🗑️ DELETE PRODUCT (SOFT)
// ========================
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });

    const sellerId = product.seller?.toString();
    const userId = req.user?.id;
    const role = req.user?.role;

    if (
      sellerId &&
      sellerId !== userId &&
      role !== "admin" &&
      role !== "seller"
    )
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa sản phẩm này",
      });

    await Product.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({ success: true, message: "Xóa sản phẩm thành công" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// 🧑‍💼 GET PRODUCTS BY SELLER
// ========================
exports.getProductsBySeller = async (req, res) => {
  try {
    const sellerId = req.params.sellerId || req.user.id;

    const products = await Product.find({ seller: sellerId })
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// 📂 GET PRODUCTS BY CATEGORY
// ========================
exports.getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.categoryId })
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
