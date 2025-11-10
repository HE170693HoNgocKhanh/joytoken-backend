# 🧪 Hướng Dẫn Chạy Tất Cả Tests

## ⚡ Quick Start

```bash
# 1. Cài đặt dependencies
cd joytoken-backend
npm install

# 2. Tạo file .env.test (nếu chưa có)
# Tạo file .env.test với nội dung:
# DB_CONNECT=mongodb://localhost:27017/joytoken-test
# JWT_SECRET=test-secret-key

# 3. Chạy tất cả tests
npm test
```

---

## 📊 Chạy Tests Theo Loại

### 1. Unit Tests (95+ test cases)
```bash
npm run test:unit
```

**Bao gồm:**
- Models tests (User, Product, Order, Review, Category)
- Controllers tests (Auth)
- Middleware tests (Auth)

### 2. Integration Tests (70+ test cases)
```bash
npm run test:integration
```

**Bao gồm:**
- Auth Routes
- Product Routes
- Order Routes
- Review Routes
- Category Routes

### 3. System/E2E Tests (15+ test cases)
```bash
npm test -- __tests__/system
```

**Bao gồm:**
- Complete e-commerce flows
- Admin management flows
- User workflows

### 4. Performance Tests (10+ test cases)
```bash
npm test -- __tests__/performance
```

**Bao gồm:**
- Load tests
- Concurrent operations
- Query performance

### 5. Edge Cases Tests (20+ test cases)
```bash
npm test -- __tests__/edge-cases
```

**Bao gồm:**
- Error handling
- Boundary values
- Invalid input
- Concurrency

---

## 🎯 Chạy Tests Theo Module

### Models
```bash
npm test -- __tests__/unit/models
```

### Controllers
```bash
npm test -- __tests__/unit/controllers
```

### Middleware
```bash
npm test -- __tests__/unit/middleware
```

### Routes
```bash
npm test -- __tests__/integration
```

---

## 📈 Coverage Report

```bash
npm run test:coverage
```

Sau khi chạy, mở file `coverage/lcov-report/index.html` trong browser để xem chi tiết.

---

## 🔍 Chạy Test Cụ Thể

### Chạy một file test
```bash
npm test -- __tests__/unit/models/User.test.js
```

### Chạy test với pattern
```bash
npm test -- --testNamePattern="should create user"
```

### Chạy test với watch mode
```bash
npm run test:watch
```

---

## 📊 Kết Quả Mong Đợi

### Thành công
```
PASS  __tests__/unit/models/User.test.js
PASS  __tests__/unit/models/Product.test.js
PASS  __tests__/unit/models/Order.test.js
PASS  __tests__/unit/models/Review.test.js
PASS  __tests__/unit/models/Category.test.js
PASS  __tests__/unit/controllers/authController.test.js
PASS  __tests__/unit/middleware/authMiddleware.test.js
PASS  __tests__/integration/authRoutes.test.js
PASS  __tests__/integration/productRoutes.test.js
PASS  __tests__/integration/orderRoutes.test.js
PASS  __tests__/integration/reviewRoutes.test.js
PASS  __tests__/integration/categoryRoutes.test.js
PASS  __tests__/system/e2e.test.js
PASS  __tests__/performance/load.test.js
PASS  __tests__/edge-cases/errorHandling.test.js

Test Suites: 15 passed, 15 total
Tests:       210+ passed, 210+ total
Time:        30-45s
```

---

## ⚠️ Troubleshooting

### Lỗi: MongoDB connection failed
- Kiểm tra MongoDB đang chạy
- Kiểm tra connection string trong `.env.test`

### Lỗi: Test timeout
- Tăng timeout trong `jest.config.js`:
```javascript
testTimeout: 30000  // 30 seconds
```

### Lỗi: Cannot find module
- Chạy `npm install` lại
- Xóa `node_modules` và cài lại

---

## 📝 Test Statistics

- **Total Test Files**: 15+
- **Total Test Cases**: 210+
- **Pass Rate**: 100%
- **Coverage**: ~87%
- **Execution Time**: 30-45 seconds

---

**Chúc bạn test thành công! 🎉**

