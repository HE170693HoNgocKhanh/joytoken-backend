# 📋 Logic Tìm Kiếm Sản Phẩm Theo Sự Kiện của Chatbot

## 🔍 Khi User Hỏi "Quà Sinh Nhật" hoặc Sự Kiện Khác

### Bước 1: Phát Hiện Sự Kiện
- Chatbot sử dụng hàm `detectEvent()` để phát hiện sự kiện từ câu hỏi
- Ví dụ: "quà sinh nhật" → phát hiện sự kiện "sinh nhật" / "birthday"
- Từ khóa tìm kiếm: `["sinh nhật", "birthday", "quà sinh nhật", "mừng tuổi", "kỷ niệm"]`

### Bước 2: Tìm Kiếm Sản Phẩm (Theo Thứ Tự Ưu Tiên)

#### **Bước 2.1: Tìm trong trường `events` và `tags` (Ưu tiên cao nhất)**
```javascript
// Tìm sản phẩm có:
- events: ["birthday"] 
- tags: ["sinh nhật", "birthday", "quà sinh nhật"]
```
**Nguồn dữ liệu:** Trường `events` và `tags` trong Product model
**Cách gán:** Admin/Seller cần gán khi tạo/cập nhật sản phẩm

#### **Bước 2.2: Tìm trong `name` và `description` (Fallback)**
```javascript
// Tìm sản phẩm có tên hoặc mô tả chứa từ khóa:
- name: chứa "sinh nhật", "birthday", "quà sinh nhật"...
- description: chứa "sinh nhật", "birthday", "quà sinh nhật"...
```
**Nguồn dữ liệu:** Trường `name` và `description` trong Product model
**Ví dụ:** Sản phẩm có tên "Gấu bông sinh nhật" sẽ được tìm thấy

#### **Bước 2.3: Lấy sản phẩm bestseller/mới/rating cao (Fallback cuối)**
```javascript
// Nếu không tìm thấy, lấy:
- isBestSeller: true
- isNew: true
- rating cao
- countInStock > 0 (còn hàng)
```
**Nguồn dữ liệu:** Trường `isBestSeller`, `isNew`, `rating`, `countInStock` trong Product model
**Lý do:** Sản phẩm bestseller/mới thường phù hợp làm quà tặng

## 📊 Tóm Tắt Nguồn Dữ Liệu

| Bước | Trường Dữ Liệu | Nguồn | Ghi Chú |
|------|---------------|-------|---------|
| 2.1 | `events`, `tags` | Product model | **Cần gán thủ công** khi tạo/cập nhật sản phẩm |
| 2.2 | `name`, `description` | Product model | Tự động tìm nếu tên/mô tả chứa từ khóa |
| 2.3 | `isBestSeller`, `isNew`, `rating`, `countInStock` | Product model | Fallback khi không tìm thấy |

## ⚠️ Vấn Đề Hiện Tại

1. **Nếu sản phẩm chưa có `events`/`tags`:** 
   - Chỉ tìm được nếu tên/mô tả chứa từ khóa sự kiện
   - Nếu không, sẽ lấy bestseller/mới (không chính xác 100%)

2. **Giải pháp:**
   - Admin/Seller cần gán `events` và `tags` khi tạo/cập nhật sản phẩm
   - Ví dụ: Sản phẩm phù hợp sinh nhật → `events: ["birthday"]`, `tags: ["sinh nhật", "quà tặng"]`

## 💡 Cách Gán Events/Tags Cho Sản Phẩm

### Qua MongoDB:
```javascript
db.products.updateOne(
  { _id: ObjectId("...") },
  { 
    $set: { 
      events: ["birthday", "valentine"],
      tags: ["sinh nhật", "quà tặng", "dễ thương"]
    }
  }
)
```

### Qua API (cần implement):
```javascript
PUT /api/products/:id
{
  "events": ["birthday", "valentine"],
  "tags": ["sinh nhật", "quà tặng", "dễ thương"]
}
```

## 🎯 Kết Luận

**Hiện tại chatbot lấy dữ liệu từ:**
1. ✅ Trường `events` và `tags` (nếu đã gán)
2. ✅ Trường `name` và `description` (tìm theo từ khóa)
3. ✅ Trường `isBestSeller`, `isNew`, `rating` (fallback)

**Để tìm kiếm chính xác hơn:** Cần gán `events` và `tags` cho sản phẩm khi tạo/cập nhật.

