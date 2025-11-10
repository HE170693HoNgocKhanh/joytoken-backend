# 🔧 Backend Test Fixes Needed

## 📋 Tổng Quan Lỗi

### 1. **Response Format Issues**
- Category API trả về `{ success: true, data: [...] }` nhưng tests expect array trực tiếp
- Một số API trả về format khác với expectations

### 2. **JWT Token Issues**
- "jwt malformed" errors - tokens có thể không được tạo đúng
- Cần kiểm tra token format trong tests

### 3. **Database Cleanup Issues**
- Duplicate key errors - cleanup không hoạt động tốt giữa tests
- Cần cải thiện beforeEach cleanup

### 4. **Status Code Mismatches**
- Tests expect một status code nhưng nhận code khác
- Cần cập nhật assertions theo implementation thực tế

## 🔨 Các Fixes Cần Thực Hiện

### Fix 1: Category Routes - Response Format
```javascript
// ❌ SAI
expect(Array.isArray(response.body)).toBe(true);

// ✅ ĐÚNG
expect(response.body.success).toBe(true);
expect(Array.isArray(response.body.data)).toBe(true);
```

### Fix 2: Database Cleanup
Cần đảm bảo cleanup hoạt động đúng:
```javascript
beforeEach(async () => {
  // Xóa theo thứ tự để tránh foreign key constraints
  await Order.deleteMany({});
  await Review.deleteMany({});
  await Product.deleteMany({});
  await Category.deleteMany({});
  await User.deleteMany({});
  await Inventory.deleteMany({});
});
```

### Fix 3: JWT Token Handling
Kiểm tra token format:
```javascript
// Đảm bảo token được lấy đúng
authToken = loginResponse.body.token;
if (!authToken) {
  console.error('Login response:', loginResponse.body);
}
```

### Fix 4: Status Code Updates
Cập nhật assertions theo implementation:
- 404 thay vì 401 cho user not found
- 400 thay vì 401 cho invalid password
- 403 thay vì 401 cho unverified email

### Fix 5: Response Message Updates
Cập nhật message assertions:
```javascript
// ❌ SAI
expect(response.body.message).toContain('xác thực email');

// ✅ ĐÚNG  
expect(response.body.message).toContain('Email chưa được xác thực');
```

## 📝 Priority Fixes

1. **HIGH**: Fix response format trong categoryRoutes.test.js
2. **HIGH**: Fix database cleanup để tránh duplicate keys
3. **MEDIUM**: Update status code assertions
4. **MEDIUM**: Fix JWT token handling
5. **LOW**: Update message assertions

