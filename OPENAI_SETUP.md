# 🔑 Hướng Dẫn Cấu Hình OpenAI API Key

## ❌ Lỗi: Invalid API Key

Nếu bạn gặp lỗi `invalid_api_key`, hãy làm theo các bước sau:

## 📝 Các Bước Cấu Hình

### 1. Lấy API Key từ OpenAI

1. Truy cập: https://platform.openai.com/account/api-keys
2. Đăng nhập vào tài khoản OpenAI của bạn
3. Click "Create new secret key"
4. Copy API key (chỉ hiển thị 1 lần, hãy lưu lại!)

### 2. Thêm API Key vào file .env

Tạo hoặc mở file `.env` trong thư mục `joytoken-backend/`:

```env
OPENAI_API_KEY=sk-proj-your-actual-api-key-here
```

**Lưu ý:**
- Không có khoảng trắng xung quanh dấu `=`
- Không có dấu ngoặc kép
- API key bắt đầu với `sk-proj-` hoặc `sk-`

### 3. Khởi động lại server

Sau khi thêm API key, khởi động lại backend server:

```bash
npm start
# hoặc
nodemon src/server.js
```

## ✅ Kiểm Tra

Sau khi cấu hình, chatbot sẽ:
- ✅ Gọi OpenAI API thành công
- ✅ Trả lời câu hỏi bằng AI
- ✅ Sử dụng RAG để tìm sản phẩm từ database

## 🔄 Fallback Mode

Nếu không có API key hoặc API key không hợp lệ:
- Chatbot vẫn hoạt động với chế độ fallback
- Trả lời dựa trên sản phẩm tìm được từ database
- Gợi ý liên hệ nhân viên để được tư vấn

## 💰 Chi Phí

- OpenAI API có tính phí theo số lượng tokens sử dụng
- Model `gpt-4o-mini` có giá rẻ nhất (~$0.15/1M input tokens)
- Bạn có thể xem usage tại: https://platform.openai.com/usage

## 🛡️ Bảo Mật

- **KHÔNG** commit file `.env` lên Git
- File `.env` đã được thêm vào `.gitignore`
- **KHÔNG** chia sẻ API key với người khác
- Nếu API key bị lộ, hãy xóa và tạo key mới ngay lập tức

## 📞 Hỗ Trợ

Nếu vẫn gặp vấn đề:
1. Kiểm tra API key có đúng format không
2. Kiểm tra tài khoản OpenAI có đủ credit không
3. Kiểm tra file `.env` có được load đúng không
4. Xem logs trong console để biết lỗi cụ thể

