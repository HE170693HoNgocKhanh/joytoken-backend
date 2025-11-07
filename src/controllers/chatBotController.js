const { openAIRequest } = require("../config/openaiconfig");
const Product = require("../models/Product");
const Category = require("../models/Category");

// 🎉 Mapping sự kiện → từ khóa tìm kiếm sản phẩm
const EVENT_KEYWORDS = {
  "sinh nhật": ["sinh nhật", "birthday", "quà sinh nhật", "mừng tuổi", "kỷ niệm"],
  "birthday": ["sinh nhật", "birthday", "quà sinh nhật", "mừng tuổi", "kỷ niệm"],
  "halloween": ["halloween", "ma quỷ", "kinh dị", "đen", "cam", "bí ngô", "phù thủy"],
  "giáng sinh": ["giáng sinh", "christmas", "noel", "ông già noel", "tuyết", "cây thông", "quà noel"],
  "christmas": ["giáng sinh", "christmas", "noel", "ông già noel", "tuyết", "cây thông", "quà noel"],
  "noel": ["giáng sinh", "christmas", "noel", "ông già noel", "tuyết", "cây thông", "quà noel"],
  "tết": ["tết", "năm mới", "lunar new year", "đỏ", "vàng", "may mắn", "phúc lộc"],
  "valentine": ["valentine", "tình yêu", "tim", "hồng", "đỏ", "quà tặng người yêu", "14/2"],
  "8/3": ["8/3", "phụ nữ", "quốc tế phụ nữ", "quà tặng phụ nữ", "hồng", "dễ thương"],
  "20/10": ["20/10", "phụ nữ việt nam", "quà tặng phụ nữ", "hồng", "dễ thương"],
  "1/6": ["1/6", "thiếu nhi", "trẻ em", "quà tặng trẻ em", "dễ thương", "màu sắc"],
  "khai trương": ["khai trương", "tân gia", "chúc mừng", "may mắn"],
  "tốt nghiệp": ["tốt nghiệp", "chúc mừng", "thành công", "may mắn"]
};

// 🔍 Tìm sự kiện từ query
const detectEvent = (query) => {
  const lowerQuery = query.toLowerCase();
  
  for (const [event, keywords] of Object.entries(EVENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        return {
          event: event,
          keywords: keywords,
          detectedKeyword: keyword
        };
      }
    }
  }
  
  return null;
};

// 🔍 Phát hiện filter type: bestseller, new, back in stock
const detectProductFilter = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Từ khóa cho bestseller
  const bestsellerKeywords = ["bestseller", "best seller", "bán chạy", "ban chay", "sản phẩm bán chạy", "hot seller"];
  // Từ khóa cho sản phẩm mới (gộp cả hàng vừa về)
  const newKeywords = ["sản phẩm mới", "san pham moi", "mới", "moi", "new", "new in", "hàng mới", "hang moi", "sản phẩm mới về", "san pham moi ve"];
  // Từ khóa cho hàng vừa về
  const backInStockKeywords = ["hàng vừa về", "hang vua ve", "vừa về", "vua ve", "back in stock", "vừa nhập", "vua nhap"];
  
  if (bestsellerKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return "bestseller";
  }
  
  // Kiểm tra hàng vừa về trước (vì nó cụ thể hơn)
  if (backInStockKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return "back_in_stock";
  }
  
  if (newKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return "new"; // "new" sẽ bao gồm cả isNew và isBackInStock
  }
  
  return null;
};

// 🔍 RAG: Tìm kiếm sản phẩm liên quan từ database
const searchRelevantProducts = async (userQuery) => {
  try {
    const lowerQuery = userQuery.toLowerCase();
    
    // 🔹 Bước 0: Kiểm tra xem có phải là câu hỏi về filter (bestseller, new, back in stock) không
    const detectedFilter = detectProductFilter(userQuery);
    let filteredProducts = [];
    
    if (detectedFilter) {
      console.log(`🔍 Phát hiện filter: ${detectedFilter}`);
      
      let queryConditions = { isActive: true };
      
      if (detectedFilter === "bestseller") {
        queryConditions.isBestSeller = true;
        console.log(`⭐ Tìm sản phẩm bestseller`);
      } else if (detectedFilter === "new") {
        // Gộp cả sản phẩm mới và hàng vừa về
        queryConditions.$or = [
          { isNew: true },
          { isBackInStock: true }
        ];
        console.log(`🆕 Tìm sản phẩm mới (bao gồm cả hàng vừa về)`);
      } else if (detectedFilter === "back_in_stock") {
        queryConditions.isBackInStock = true;
        queryConditions.countInStock = { $gt: 0 }; // Phải còn hàng
        console.log(`📦 Tìm hàng vừa về`);
      }
      
      filteredProducts = await Product.find(queryConditions)
        .populate("category", "name")
        .select("_id name description price image countInStock rating variants isBestSeller isNew isBackInStock label events")
        .sort({ rating: -1, numReviews: -1 })
        .limit(20)
        .lean();
      
      console.log(`✅ Tìm thấy ${filteredProducts.length} sản phẩm với filter ${detectedFilter}`);
      
      // Nếu tìm thấy filter, trả về ngay (không tìm thêm event hay category)
      if (filteredProducts.length > 0) {
        const categories = await Category.find({ isActive: true })
          .select("name description _id")
          .lean();
        
        return {
          products: filteredProducts.map(p => ({
            _id: p._id.toString(),
            name: p.name,
            description: p.description,
            price: p.price,
            image: p.image,
            category: p.category?.name || "N/A",
            inStock: p.countInStock > 0,
            rating: p.rating || 0,
            variants: p.variants || [],
            isBestSeller: p.isBestSeller || false,
            isNew: p.isNew || false,
            isBackInStock: p.isBackInStock || false,
            label: p.label || null,
            events: p.events || []
          })),
          categories: categories.map(c => ({
            name: c.name,
            description: c.description
          })),
          matchedCategory: null,
          detectedEvent: null,
          detectedFilter: detectedFilter
        };
      }
    }
    
    // 🔹 Bước 1: Kiểm tra xem có phải là câu hỏi về sự kiện không
    const detectedEvent = detectEvent(userQuery);
    let eventProducts = [];
    
    if (detectedEvent) {
      console.log(`🎉 Phát hiện sự kiện: ${detectedEvent.event} (từ khóa: ${detectedEvent.detectedKeyword})`);
      
      // 🔹 CHỈ tìm kiếm sản phẩm có trường events chứa sự kiện (KHÔNG fallback)
      const eventName = detectedEvent.event;
      // Tìm trong events với event name và các keywords
      // Đảm bảo tìm cả tiếng Việt và tiếng Anh (ví dụ: "sinh nhật" và "birthday")
      const searchTerms = [eventName, ...detectedEvent.keywords];
      // Loại bỏ trùng lặp
      const uniqueSearchTerms = [...new Set(searchTerms)];
      
      // Tìm kiếm trong array events: $in sẽ match nếu bất kỳ phần tử nào trong events array khớp với bất kỳ giá trị nào trong uniqueSearchTerms
      // Ví dụ: nếu events = ["birthday", "sinh nhật"] và searchTerms = ["sinh nhật", "birthday"] → sẽ match
      eventProducts = await Product.find({
        isActive: true,
        events: { $in: uniqueSearchTerms }
      })
        .populate("category", "name")
        .select("_id name description price image countInStock rating variants isBestSeller isNew isBackInStock label events")
        .sort({ isBestSeller: -1, isNew: -1, rating: -1 }) // Ưu tiên bestseller, mới, đánh giá cao
        .limit(20)
        .lean();
      
      console.log(`🎁 Tìm thấy ${eventProducts.length} sản phẩm có events phù hợp với sự kiện ${detectedEvent.event}`);
      
      // Nếu tìm thấy event products, trả về ngay (không fallback)
      if (eventProducts.length > 0) {
        const categories = await Category.find({ isActive: true })
          .select("name description _id")
          .lean();
        
        return {
          products: eventProducts.map(p => ({
            _id: p._id.toString(),
            name: p.name,
            description: p.description,
            price: p.price,
            image: p.image,
            category: p.category?.name || "N/A",
            inStock: p.countInStock > 0,
            rating: p.rating || 0,
            variants: p.variants || [],
            isBestSeller: p.isBestSeller || false,
            isNew: p.isNew || false,
            isBackInStock: p.isBackInStock || false,
            label: p.label || null,
            events: p.events || []
          })),
          categories: categories.map(c => ({
            name: c.name,
            description: c.description
          })),
          matchedCategory: null,
          detectedEvent: {
            event: detectedEvent.event,
            keywords: detectedEvent.keywords
          },
          detectedFilter: null
        };
      } else {
        // Nếu không tìm thấy sản phẩm với event, trả về mảng rỗng
        console.log(`⚠️ Không tìm thấy sản phẩm nào có event ${detectedEvent.event}`);
        const categories = await Category.find({ isActive: true })
          .select("name description _id")
          .lean();
        
        return {
          products: [],
          categories: categories.map(c => ({
            name: c.name,
            description: c.description
          })),
          matchedCategory: null,
          detectedEvent: {
            event: detectedEvent.event,
            keywords: detectedEvent.keywords
          },
          detectedFilter: null
        };
      }
    }
    
    // 🔹 Bước 1: Tìm kiếm category theo tên
    const categories = await Category.find({ isActive: true })
      .select("name description _id")
      .lean();
    
    // Tìm category khớp với query (ví dụ: "animals", "animal", "động vật")
    // Loại bỏ các từ không cần thiết như "tôi muốn tìm", "các sản phẩm", "thuộc", "loại"
    const stopWords = ["tôi", "muốn", "tìm", "các", "sản", "phẩm", "thuộc", "loại", "danh", "mục", "của", "về"];
    const queryWords = lowerQuery
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    let matchedCategory = null;
    let bestMatch = null;
    let bestScore = 0;
    
    for (const cat of categories) {
      const catNameLower = cat.name.toLowerCase();
      let score = 0;
      
      // Kiểm tra nếu query chứa tên category hoặc ngược lại
      if (lowerQuery.includes(catNameLower) || catNameLower.includes(lowerQuery)) {
        score = 10;
      }
      
      // Kiểm tra từng từ trong query có khớp với tên category không
      for (const word of queryWords) {
        if (catNameLower.includes(word) || word.includes(catNameLower)) {
          score += 5;
        }
      }
      
      // Nếu tên category khớp chính xác với một từ trong query
      if (queryWords.some(word => word === catNameLower || catNameLower === word)) {
        score += 15;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cat;
      }
    }
    
    // Chỉ chọn category nếu score đủ cao (ít nhất 5 điểm)
    if (bestScore >= 5) {
      matchedCategory = bestMatch;
      console.log(`✅ Tìm thấy category: ${matchedCategory.name} (score: ${bestScore})`);
    }
    
    // Nếu tìm thấy category, lấy tất cả sản phẩm thuộc category đó
    let products = [];
    if (matchedCategory) {
      console.log(`🔍 Đang tìm sản phẩm thuộc category: ${matchedCategory.name}`);
      products = await Product.find({
        isActive: true,
        category: matchedCategory._id
      })
        .populate("category", "name")
        .select("_id name description price image countInStock rating variants isBestSeller isNew label")
        .limit(20) // Lấy nhiều hơn khi tìm theo category
        .lean();
      
      console.log(`📦 Tìm thấy ${products.length} sản phẩm thuộc category ${matchedCategory.name}`);
    } else {
      // Nếu không tìm thấy category, tìm kiếm theo tên và mô tả sản phẩm
      const keywords = lowerQuery
        .split(/\s+/)
        .filter(word => word.length > 2);

      const searchConditions = [
        { name: { $regex: userQuery, $options: "i" } },
        { description: { $regex: userQuery, $options: "i" } }
      ];
      
      keywords.forEach(keyword => {
        searchConditions.push(
          { name: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } }
        );
      });

      products = await Product.find({
        isActive: true,
        $or: searchConditions
      })
        .populate("category", "name")
        .select("_id name description price image countInStock rating variants isBestSeller isNew label")
        .limit(10)
        .lean();
    }

    // Trả về sản phẩm tìm được (category hoặc general search)
    return {
      products: products.map(p => ({
        _id: p._id.toString(),
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        category: p.category?.name || "N/A",
        inStock: p.countInStock > 0,
        rating: p.rating || 0,
        variants: p.variants || [],
        isBestSeller: p.isBestSeller || false,
        isNew: p.isNew || false,
        isBackInStock: p.isBackInStock || false,
        label: p.label || null,
        events: p.events || []
      })),
      categories: categories.map(c => ({
        name: c.name,
        description: c.description
      })),
      matchedCategory: matchedCategory ? {
        name: matchedCategory.name,
        description: matchedCategory.description
      } : null,
      detectedEvent: null,
      detectedFilter: null
    };
  } catch (error) {
    console.error("Error searching products:", error);
    return { products: [], categories: [], matchedCategory: null, detectedEvent: null, detectedFilter: null };
  }
};

const getAIResponse = async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Vui lòng nhập câu hỏi." });
  }

  try {
    // 🔍 Bước 1: Tìm kiếm sản phẩm liên quan (RAG)
    const relevantData = await searchRelevantProducts(query);
    
    // 🤖 Bước 2: Gọi OpenAI với context từ database (có fallback nếu lỗi)
    const aiResponse = await openAIRequest(query, relevantData);
    
    // Nếu có matchedCategory, detectedEvent, hoặc detectedFilter, trả về nhiều sản phẩm hơn
    // Nếu không, chỉ trả về 5 sản phẩm đầu tiên
    const productLimit = (relevantData.matchedCategory || relevantData.detectedEvent || relevantData.detectedFilter) ? 20 : 5;
    
    res.json({ 
      response: aiResponse,
      relevantProducts: relevantData.products.slice(0, productLimit)
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    
    // Fallback: Vẫn trả về response dựa trên RAG nếu có
    try {
      const relevantData = await searchRelevantProducts(query);
      const fallbackResponse = `Xin lỗi, hệ thống AI đang gặp sự cố. Nhưng mình vẫn có thể giúp bạn:\n\n${
        relevantData.products.length > 0 
          ? `Tìm thấy ${relevantData.products.length} sản phẩm liên quan. Bạn có thể xem trên website hoặc chat với nhân viên để được tư vấn! 💬`
          : "Bạn có thể tìm kiếm sản phẩm trên website hoặc chat với nhân viên để được hỗ trợ! 💬"
      }`;
      
      res.json({ 
        response: fallbackResponse,
        relevantProducts: relevantData.products.slice(0, 5)
      });
    } catch (fallbackError) {
      res.status(500).json({ 
        error: "Không thể lấy phản hồi. Vui lòng thử lại sau hoặc liên hệ nhân viên." 
      });
    }
  }
};

module.exports = { getAIResponse };
