require("dotenv").config();
const axios = require("axios");

const API_URL = "https://api.openai.com/v1/chat/completions";
const API_KEY = process.env.OPENAI_API_KEY;

// 🔄 Fallback response khi không có API key hoặc API lỗi
const getFallbackResponse = (userQuery, relevantData) => {
  const lowerQuery = userQuery.toLowerCase();
  
  // Nếu có sản phẩm liên quan, trả lời dựa trên đó
  if (relevantData.products && relevantData.products.length > 0) {
    let response = "";
    
    // Nếu có detectedFilter, hiển thị thông tin filter
    if (relevantData.detectedFilter) {
      const filterMessages = {
        "bestseller": "⭐ Đây là các sản phẩm **bán chạy nhất** (Bestseller) của chúng mình",
        "new": "🆕 Đây là các **sản phẩm mới** vừa được thêm vào cửa hàng",
        "back_in_stock": "📦 Đây là các sản phẩm **vừa về hàng** - hàng mới nhập kho"
      };
      response = `${filterMessages[relevantData.detectedFilter] || "Dưới đây là các sản phẩm"} (${relevantData.products.length} sản phẩm):\n\n`;
    } else if (relevantData.detectedEvent) {
      // Nếu có detectedEvent, ưu tiên hiển thị thông tin sự kiện
      const eventName = relevantData.detectedEvent.event;
      const eventMessages = {
        "sinh nhật": "🎂 Chúc mừng sinh nhật! Jellycat là món quà hoàn hảo cho dịp đặc biệt này. Dưới đây là các sản phẩm phù hợp",
        "birthday": "🎂 Happy Birthday! Jellycat makes a perfect gift for this special occasion. Here are suitable products",
        "halloween": "🎃 Happy Halloween! Spooky and cute Jellycat products perfect for this fun holiday. Here are our recommendations",
        "giáng sinh": "🎄 Chúc mừng Giáng sinh! Jellycat là món quà ấm áp và dễ thương cho mùa lễ hội. Dưới đây là các sản phẩm phù hợp",
        "christmas": "🎄 Merry Christmas! Jellycat makes a warm and adorable gift for the holiday season. Here are suitable products",
        "noel": "🎄 Chúc mừng Noel! Jellycat là món quà ấm áp và dễ thương cho mùa lễ hội. Dưới đây là các sản phẩm phù hợp",
        "tết": "🧧 Chúc mừng năm mới! Jellycat mang lại may mắn và hạnh phúc cho năm mới. Dưới đây là các sản phẩm phù hợp",
        "valentine": "💝 Happy Valentine's Day! Jellycat expresses love and affection perfectly. Here are romantic gift ideas",
        "8/3": "🌸 Chúc mừng Ngày Quốc tế Phụ nữ 8/3! Jellycat là món quà dễ thương và ý nghĩa. Dưới đây là các sản phẩm phù hợp",
        "20/10": "🌺 Chúc mừng Ngày Phụ nữ Việt Nam 20/10! Jellycat là món quà dễ thương và ý nghĩa. Dưới đây là các sản phẩm phù hợp",
        "1/6": "🎈 Chúc mừng Ngày Quốc tế Thiếu nhi 1/6! Jellycat là món quà an toàn và dễ thương cho các bé. Dưới đây là các sản phẩm phù hợp",
        "khai trương": "🎊 Chúc mừng khai trương! Jellycat mang lại may mắn và thành công. Dưới đây là các sản phẩm phù hợp",
        "tốt nghiệp": "🎓 Chúc mừng tốt nghiệp! Jellycat là món quà ý nghĩa cho thành công mới. Dưới đây là các sản phẩm phù hợp"
      };
      
      response = `${eventMessages[eventName] || `🎉 Chúc mừng ${eventName}! Dưới đây là các sản phẩm phù hợp`} (${relevantData.products.length} sản phẩm):\n\n`;
    } else if (relevantData.matchedCategory) {
      response = `Dưới đây là các sản phẩm thuộc danh mục **${relevantData.matchedCategory.name}** (${relevantData.products.length} sản phẩm):\n\n`;
    } else {
      response = "Dựa trên câu hỏi của bạn, mình tìm thấy các sản phẩm sau:\n\n";
    }
    
    // Hiển thị tất cả sản phẩm (không giới hạn 3)
    relevantData.products.forEach((p, idx) => {
      response += `${idx + 1}. **${p.name}**\n`;
      response += `   - Giá: ${p.price?.toLocaleString("vi-VN")} ₫\n`;
      response += `   - ${p.inStock ? "✅ Còn hàng" : "❌ Hết hàng"}\n`;
      if (p.description) {
        response += `   - ${p.description.substring(0, 100)}...\n`;
      }
      response += "\n";
    });
    response += "Bạn có thể click vào sản phẩm bên dưới để xem chi tiết hoặc chat với nhân viên để được tư vấn thêm! 💬";
    return response;
  }
  
  // Trả lời chung dựa trên từ khóa
  if (lowerQuery.includes("giá") || lowerQuery.includes("bao nhiêu")) {
    return "Giá sản phẩm được hiển thị rõ trên website. Bạn có thể xem chi tiết trên trang sản phẩm hoặc liên hệ nhân viên để được tư vấn cụ thể! 💰";
  }
  
  if (lowerQuery.includes("còn hàng") || lowerQuery.includes("tồn kho")) {
    return "Tình trạng tồn kho được cập nhật thường xuyên trên website. Bạn có thể kiểm tra trên trang chi tiết sản phẩm hoặc chat với nhân viên để biết chính xác! 📦";
  }
  
  if (lowerQuery.includes("mua") || lowerQuery.includes("đặt hàng")) {
    return "Để mua hàng, bạn có thể:\n1. Thêm sản phẩm vào giỏ hàng\n2. Thanh toán qua thẻ, MoMo hoặc chuyển khoản\n3. Xác nhận đơn hàng\n\nNếu cần hỗ trợ, hãy chat với nhân viên nhé! 🛒";
  }
  
  if (lowerQuery.includes("jellycat") || lowerQuery.includes("là gì")) {
    return "Jellycat là thương hiệu thú nhồi bông cao cấp từ London, Anh Quốc. Sản phẩm được làm từ vải mềm mại (polyester), an toàn cho trẻ em từ 12 tháng tuổi trở lên. Các dòng sản phẩm nổi tiếng bao gồm: Amuseable, Bashful Bunny, Fuddlewuddle, Bartholomew Bear, và nhiều dòng khác! 🧸";
  }
  
  if (lowerQuery.includes("quà") || lowerQuery.includes("tặng")) {
    return "Chúng mình có nhiều sản phẩm phù hợp làm quà tặng! Bạn có thể tìm theo danh mục trên website hoặc chat với nhân viên để được tư vấn chọn quà phù hợp nhất! 🎁";
  }
  
  // Câu hỏi về lý do mua hàng
  if (lowerQuery.includes("tại sao") && (lowerQuery.includes("mua") || lowerQuery.includes("nên") || lowerQuery.includes("chọn"))) {
    return `Cảm ơn bạn đã quan tâm! Dưới đây là những lý do bạn nên mua hàng tại Jellycat Store:

1. **Chất lượng đảm bảo:** ✅ Hàng chính hãng 100% từ Jellycat London, Anh Quốc. Chất liệu cao cấp, mềm mại, an toàn cho trẻ em từ 12 tháng tuổi trở lên.

2. **Dịch vụ tuyệt vời:** ✅ Hỗ trợ tư vấn 24/7, giao hàng nhanh toàn quốc, gói quà miễn phí đẹp mắt, chính sách đổi trả linh hoạt trong 7 ngày, bảo hành chất lượng 1 năm.

3. **Giá trị cao:** ✅ Sản phẩm bền đẹp, phù hợp làm quà tặng cho mọi dịp (sinh nhật, Giáng sinh, Valentine, Tết...). Có voucher giảm 5% cho đơn từ 3 sản phẩm trở lên (tối đa 10,000₫).

4. **Uy tín và đáng tin cậy:** ✅ Cửa hàng uy tín, được nhiều khách hàng tin tưởng, sản phẩm có đánh giá cao.

5. **Trải nghiệm mua sắm tốt:** ✅ Website dễ sử dụng, thanh toán đa dạng (thẻ, MoMo, chuyển khoản), chatbot AI hỗ trợ nhanh chóng.

Bạn muốn xem sản phẩm nào cụ thể không? Mình có thể tư vấn thêm! 😊`;
  }
  
  // Trả lời mặc định
  return "Xin chào! Mình là Jellycat Assistant 🧸. Hiện tại hệ thống AI đang gặp sự cố, nhưng mình vẫn có thể giúp bạn:\n\n- Tìm kiếm sản phẩm trên website\n- Chat với nhân viên để được tư vấn chi tiết\n- Xem thông tin sản phẩm, giá cả, và tồn kho\n\nBạn muốn hỗ trợ gì hôm nay? 💬";
};

const openAIRequest = async (userInput, relevantData = { products: [], categories: [] }) => {
  // Kiểm tra API key
  if (!API_KEY || API_KEY.trim() === "") {
    console.warn("⚠️ OpenAI API key chưa được cấu hình. Sử dụng fallback response.");
    return getFallbackResponse(userInput, relevantData);
  }
  
  try {
    // 📦 Format thông tin sản phẩm từ RAG
    let productsContext = "";
    if (relevantData.products && relevantData.products.length > 0) {
      // Nếu có detectedFilter, hiển thị thông tin filter
      if (relevantData.detectedFilter) {
        const filterDisplayName = {
          "bestseller": "⭐ SẢN PHẨM BÁN CHẠY (Bestseller)",
          "new": "🆕 SẢN PHẨM MỚI",
          "back_in_stock": "📦 HÀNG VỪA VỀ"
        };
        productsContext = `\n\n${filterDisplayName[relevantData.detectedFilter] || "SẢN PHẨM"}\n`;
        productsContext += `Dưới đây là các sản phẩm (${relevantData.products.length} sản phẩm):\n`;
      } else if (relevantData.detectedEvent) {
        // Nếu có detectedEvent, ưu tiên hiển thị thông tin sự kiện
        const eventName = relevantData.detectedEvent.event;
        const eventDisplayName = {
          "sinh nhật": "🎂 Sinh nhật",
          "birthday": "🎂 Sinh nhật",
          "halloween": "🎃 Halloween",
          "giáng sinh": "🎄 Giáng sinh",
          "christmas": "🎄 Giáng sinh",
          "noel": "🎄 Giáng sinh",
          "tết": "🧧 Tết Nguyên Đán",
          "valentine": "💝 Valentine",
          "8/3": "🌸 Ngày Quốc tế Phụ nữ (8/3)",
          "20/10": "🌺 Ngày Phụ nữ Việt Nam (20/10)",
          "1/6": "🎈 Ngày Quốc tế Thiếu nhi (1/6)",
          "khai trương": "🎊 Khai trương",
          "tốt nghiệp": "🎓 Tốt nghiệp"
        };
        
        productsContext = `\n\n${eventDisplayName[eventName] || `🎉 ${eventName}`}\n`;
        productsContext += `Dưới đây là các sản phẩm phù hợp cho sự kiện này (${relevantData.products.length} sản phẩm):\n`;
      } else if (relevantData.matchedCategory) {
        productsContext = `\n\n📂 DANH MỤC: **${relevantData.matchedCategory.name}**\n`;
        if (relevantData.matchedCategory.description) {
          productsContext += `${relevantData.matchedCategory.description}\n`;
        }
        productsContext += `\n📦 DANH SÁCH SẢN PHẨM (${relevantData.products.length} sản phẩm):\n`;
      } else {
        productsContext = "\n\n📦 DANH SÁCH SẢN PHẨM LIÊN QUAN TỪ DATABASE:\n";
      }
      
      relevantData.products.forEach((product, index) => {
        productsContext += `${index + 1}. **${product.name}**\n`;
        productsContext += `   - Mô tả: ${product.description || "N/A"}\n`;
        productsContext += `   - Giá: ${product.price?.toLocaleString("vi-VN") || "N/A"} ₫\n`;
        productsContext += `   - Danh mục: ${product.category}\n`;
        productsContext += `   - Tình trạng: ${product.inStock ? "Còn hàng" : "Hết hàng"}\n`;
        if (product.rating) {
          productsContext += `   - Đánh giá: ${product.rating}/5 ⭐\n`;
        }
        if (product.variants && product.variants.length > 0) {
          productsContext += `   - Biến thể: ${product.variants.map(v => `${v.size || ""} ${v.color || ""}`).join(", ")}\n`;
        }
        productsContext += "\n";
      });
    }

    // 📂 Format thông tin danh mục
    let categoriesContext = "";
    if (relevantData.categories && relevantData.categories.length > 0) {
      categoriesContext = "\n\n📂 DANH MỤC SẢN PHẨM:\n";
      relevantData.categories.forEach((cat, index) => {
        categoriesContext += `${index + 1}. ${cat.name}${cat.description ? ` - ${cat.description}` : ""}\n`;
      });
    }

    const promptSystem = `Bạn là trợ lý ảo chuyên nghiệp của Jellycat Store – một website bán các sản phẩm thú nhồi bông và gấu bông chính hãng từ thương hiệu Jellycat.

🎯 NHIỆM VỤ CHÍNH:
1. **Giải đáp thắc mắc về sản phẩm:**
   - Thông tin chi tiết: tên, mô tả, giá cả, chất liệu, kích thước, màu sắc, độ mềm
   - Nguồn gốc: Hàng chính hãng Jellycat từ Anh Quốc
   - Cách bảo quản: Giặt tay, phơi khô tự nhiên, tránh ánh nắng trực tiếp
   - Độ tuổi phù hợp: An toàn cho trẻ em từ 12 tháng tuổi trở lên

2. **Gợi ý sản phẩm thông minh:**
   - Dựa trên nhu cầu: quà tặng sinh nhật, dịp lễ, đồ trang trí phòng ngủ
   - **QUAN TRỌNG - SỰ KIỆN:** Khi khách hàng hỏi về một sự kiện (sinh nhật, Halloween, Giáng sinh, Tết, Valentine, 8/3, 20/10, 1/6, khai trương, tốt nghiệp), bạn PHẢI:
     * Chúc mừng và thể hiện sự nhiệt tình về sự kiện đó
     * Giải thích tại sao sản phẩm Jellycat phù hợp cho sự kiện này
     * Liệt kê TẤT CẢ các sản phẩm được gợi ý từ danh sách với tên, giá, tình trạng
     * Gợi ý cách sử dụng (quà tặng, trang trí, v.v.)
     * Ví dụ: "🎂 Chúc mừng sinh nhật! Jellycat là món quà hoàn hảo cho dịp đặc biệt này. Dưới đây là các sản phẩm phù hợp: [liệt kê sản phẩm]"
   - **QUAN TRỌNG - DANH MỤC:** Khi khách hàng hỏi về một danh mục/category (ví dụ: "animals", "động vật", "thỏ", "gấu"), bạn PHẢI liệt kê TẤT CẢ các sản phẩm thuộc danh mục đó từ danh sách sản phẩm được cung cấp. Ví dụ: "Dưới đây là các sản phẩm thuộc danh mục Animals: [liệt kê từng sản phẩm với tên, giá, tình trạng]"
   - **QUAN TRỌNG - FILTER SẢN PHẨM:** Khi khách hàng hỏi về:
     * **Bestseller/Bán chạy:** "sản phẩm bán chạy", "bestseller", "best seller", "hot seller" → Liệt kê TẤT CẢ các sản phẩm có flag isBestSeller = true từ danh sách
     * **Sản phẩm mới:** "sản phẩm mới", "hàng mới", "new", "new in", "sản phẩm mới về" → Liệt kê TẤT CẢ các sản phẩm có flag isNew = true HOẶC isBackInStock = true (gộp cả hàng vừa về) từ danh sách
     * **Hàng vừa về:** "hàng vừa về", "vừa về", "back in stock", "vừa nhập" → Liệt kê TẤT CẢ các sản phẩm có flag isBackInStock = true và còn hàng từ danh sách
   - Dựa trên sở thích: dễ thương, size nhỏ/grande, màu pastel, động vật cụ thể
   - Dựa trên độ tuổi: trẻ em, thanh thiếu niên, người lớn
   - Dựa trên ngân sách: giá cả phù hợp

3. **Hướng dẫn mua hàng:**
   - Cách đặt hàng: Thêm vào giỏ hàng → Thanh toán → Xác nhận đơn hàng
   - Phương thức thanh toán: Thẻ tín dụng, MoMo, chuyển khoản ngân hàng
   - Kiểm tra đơn hàng: Vào trang "Lịch sử đơn hàng" hoặc liên hệ nhân viên
   - Chính sách đổi/trả: 7 ngày kể từ ngày nhận hàng, sản phẩm còn nguyên vẹn
   - Chính sách bảo hành: Bảo hành chất lượng 1 năm, đổi mới nếu lỗi từ nhà sản xuất

4. **Thông tin về Jellycat:**
   - Thương hiệu: Jellycat là thương hiệu thú nhồi bông cao cấp từ London, Anh Quốc
   - Chất liệu: Vải mềm mại (polyester), an toàn, không gây dị ứng
   - Các dòng sản phẩm nổi tiếng:
     * Amuseable: Các loại rau củ, trái cây dễ thương
     * Bashful Bunny: Thỏ bông với nhiều màu sắc và kích thước
     * Fuddlewuddle: Gấu bông mềm mại, dễ thương
     * Bartholomew Bear: Gấu bông cổ điển
     * Fuzzy Friends: Thú bông có lông mềm
     * Blossom: Hoa và cây cối
     * Woodland: Động vật rừng

5. **Dịch vụ của cửa hàng:**
   - Gói quà tặng: Miễn phí gói quà đẹp mắt
   - Giao hàng: Toàn quốc, hỗ trợ giao hàng nhanh
   - Tư vấn: Hỗ trợ tư vấn chọn quà phù hợp
   - Chăm sóc khách hàng: Hotline và chat trực tuyến

6. **LÝ DO NÊN MUA HÀNG TẠI JELLYCAT STORE (QUAN TRỌNG - TRẢ LỜI KHI KHÁCH HỎI "TẠI SAO TÔI NÊN MUA HÀNG CỦA BẠN"):**
   Khi khách hàng hỏi về lý do nên mua hàng, bạn PHẢI trả lời đầy đủ và thuyết phục với các điểm sau:
   
   **a) Chất lượng sản phẩm:**
   - ✅ Hàng chính hãng 100% từ Jellycat London, Anh Quốc
   - ✅ Chất liệu cao cấp, mềm mại, an toàn cho trẻ em
   - ✅ Độ bền cao, có thể giặt và sử dụng lâu dài
   - ✅ Thiết kế độc đáo, dễ thương, phù hợp mọi lứa tuổi
   - ✅ Được kiểm định chất lượng nghiêm ngặt từ nhà sản xuất
   
   **b) Dịch vụ khách hàng:**
   - ✅ Hỗ trợ tư vấn 24/7 qua chat và hotline
   - ✅ Giao hàng nhanh chóng, toàn quốc
   - ✅ Gói quà tặng miễn phí, đẹp mắt
   - ✅ Chính sách đổi trả linh hoạt trong 7 ngày
   - ✅ Bảo hành chất lượng 1 năm
   - ✅ Hỗ trợ đổi hàng nếu sản phẩm có vấn đề
   
   **c) Giá trị và lợi ích:**
   - ✅ Sản phẩm phù hợp làm quà tặng cho mọi dịp (sinh nhật, Giáng sinh, Valentine, Tết, v.v.)
   - ✅ Nhiều mẫu mã đa dạng, từ size nhỏ đến grande
   - ✅ Giá cả hợp lý, cạnh tranh trên thị trường
   - ✅ Có voucher giảm giá cho đơn hàng lớn (5% cho đơn từ 3 sản phẩm trở lên)
   - ✅ Sản phẩm có ý nghĩa tinh thần, mang lại niềm vui và hạnh phúc
   
   **d) Uy tín và đáng tin cậy:**
   - ✅ Cửa hàng uy tín, được nhiều khách hàng tin tưởng
   - ✅ Sản phẩm có đánh giá cao từ khách hàng
   - ✅ Cam kết chất lượng và dịch vụ tốt nhất
   - ✅ Minh bạch về giá cả và chính sách
   
   **e) Trải nghiệm mua sắm:**
   - ✅ Website dễ sử dụng, giao diện thân thiện
   - ✅ Chatbot AI hỗ trợ tư vấn nhanh chóng
   - ✅ Thanh toán đa dạng (thẻ, MoMo, chuyển khoản)
   - ✅ Theo dõi đơn hàng dễ dàng
   
   **Ví dụ câu trả lời:**
   "Cảm ơn bạn đã quan tâm! Dưới đây là những lý do bạn nên mua hàng tại Jellycat Store:
   
   1. **Chất lượng đảm bảo:** Hàng chính hãng 100% từ Jellycat London, chất liệu cao cấp, an toàn cho trẻ em
   2. **Dịch vụ tuyệt vời:** Hỗ trợ 24/7, giao hàng nhanh, gói quà miễn phí, đổi trả dễ dàng
   3. **Giá trị cao:** Sản phẩm bền đẹp, phù hợp mọi dịp, có voucher giảm giá
   4. **Uy tín:** Được nhiều khách hàng tin tưởng, đánh giá cao
   5. **Trải nghiệm tốt:** Website dễ dùng, thanh toán đa dạng, chatbot hỗ trợ nhanh
   
   Bạn muốn xem sản phẩm nào cụ thể không? Mình có thể tư vấn thêm! 😊"

📋 QUY TẮC TRẢ LỜI:
- **Luôn ưu tiên thông tin từ database:** Nếu có sản phẩm liên quan trong danh sách, hãy đề cập cụ thể tên, giá, và thông tin của chúng.
- **Kiểm tra tồn kho:** Khi khách hỏi "còn hàng không?", hãy dựa vào thông tin "Tình trạng" trong danh sách sản phẩm. Nếu không có thông tin, gợi ý khách kiểm tra trên trang chi tiết hoặc chat với nhân viên.
- **Gợi ý sản phẩm cụ thể:** Khi khách nói về sở thích (màu sắc, kích thước, loại động vật), hãy liệt kê các sản phẩm phù hợp từ danh sách với tên và giá cụ thể.
- **Về giá cả:** Luôn đề cập giá chính xác từ database nếu có. Nếu không có, giải thích rằng giá có thể thay đổi theo biến thể (size, màu).
- **Về danh mục:** Khi khách hỏi về loại sản phẩm, hãy tham khảo danh sách danh mục và gợi ý các sản phẩm trong danh mục đó.
- **Không được:** Nói về thương hiệu/sản phẩm ngoài Jellycat, trả lời về chính trị, nội dung người lớn, hoặc thông tin không liên quan.
- **Phong cách:** Thân thiện, dễ thương, ngắn gọn, rõ ràng. Xưng hô tự nhiên ("bạn", "chị", "anh", "bạn yêu Jellycat").

⚠️ LƯU Ý QUAN TRỌNG:
- **Khi khách hỏi "Tại sao tôi nên mua hàng của bạn", "Lý do mua hàng", "Ưu điểm của cửa hàng", "Tại sao chọn Jellycat":** Bạn PHẢI trả lời đầy đủ theo section 6 ở trên, liệt kê rõ ràng các lý do về chất lượng, dịch vụ, giá trị, uy tín và trải nghiệm. Hãy thuyết phục và nhiệt tình!
- Nếu không có sản phẩm nào trong danh sách phù hợp với câu hỏi, hãy trả lời dựa trên kiến thức chung về Jellycat.
- Nếu không chắc chắn về thông tin, hãy đề nghị khách hàng để lại thông tin hoặc liên hệ nhân viên qua chat.
- Luôn giữ giọng văn tích cực, dễ thương và chuyên nghiệp.${productsContext}${categoriesContext}`;

    const response = await axios.post(
      API_URL,
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: promptSystem },
          { role: "user", content: userInput },
        ],
        temperature: 0.7, // Điều chỉnh độ sáng tạo (0-1)
        max_tokens: 1000, // Giới hạn độ dài response
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error.response?.data || error.message);
    
    // Xử lý các loại lỗi cụ thể
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      
      // Lỗi API key không hợp lệ
      if (apiError.code === 'invalid_api_key' || apiError.type === 'invalid_request_error') {
        console.error("❌ OpenAI API Key không hợp lệ hoặc chưa được cấu hình đúng.");
        console.error("💡 Hướng dẫn: Thêm OPENAI_API_KEY vào file .env");
        console.error("💡 Lấy API key tại: https://platform.openai.com/account/api-keys");
        
        // Trả về fallback response thay vì throw error
        return getFallbackResponse(userInput, relevantData);
      }
      
      // Lỗi khác từ OpenAI
      console.error("OpenAI API Error Details:", apiError);
      return getFallbackResponse(userInput, relevantData);
    }
    
    // Lỗi network hoặc lỗi khác
    console.error("Network or other error:", error.message);
    return getFallbackResponse(userInput, relevantData);
  }
};

module.exports = { openAIRequest };
