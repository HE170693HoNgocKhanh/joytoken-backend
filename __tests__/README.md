# Test Documentation

## Cấu trúc Test

```
__tests__/
├── unit/              # Unit Tests
│   ├── models/        # Model tests
│   ├── controllers/   # Controller tests
│   └── middleware/    # Middleware tests
├── integration/       # Integration Tests
│   ├── authRoutes.test.js
│   └── productRoutes.test.js
└── system/            # System/E2E Tests
    └── e2e.test.js
```

## Chạy Tests

```bash
# Chạy tất cả tests
npm test

# Chạy tests với watch mode
npm run test:watch

# Chạy tests với coverage
npm run test:coverage

# Chạy chỉ unit tests
npm run test:unit

# Chạy chỉ integration tests
npm run test:integration
```

## Test Coverage

- **Unit Tests**: Test các component riêng lẻ (models, controllers, middleware)
- **Integration Tests**: Test các API endpoints và tương tác giữa các components
- **System Tests**: Test các flow hoàn chỉnh từ đầu đến cuối

## Yêu cầu

- MongoDB test database (mặc định: `joytoken-test`)
- Environment variables trong `.env.test`

