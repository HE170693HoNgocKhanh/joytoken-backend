const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../helpers/app');
const Order = require('../../src/models/Order');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const User = require('../../src/models/User');
const Inventory = require('../../src/models/Inventory');
const bcrypt = require('bcryptjs');

describe('Order Routes - Integration Tests', () => {
  let app;
  let testUser;
  let testProduct;
  let testCategory;
  let authToken;

  beforeAll(async () => {
    app = createApp();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DB_CONNECT || 'mongodb://localhost:27017/joytoken-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  });

  beforeEach(async () => {
    // Clean up
    await Order.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    await Inventory.deleteMany({});

    // Create test category
    testCategory = await new Category({
      name: 'Test Category',
      description: 'Test Description'
    }).save();

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await new User({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      emailVerified: true,
      role: 'customer'
    }).save();

    // Create seller
    const seller = await new User({
      name: 'Seller',
      email: 'seller@example.com',
      password: hashedPassword,
      emailVerified: true,
      role: 'seller'
    }).save();

    // Create test product
    testProduct = await new Product({
      name: 'Test Product',
      description: 'Test Description',
      price: 100000,
      category: testCategory._id,
      seller: seller._id,
      countInStock: 10,
      isActive: true
    }).save();

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/orders', () => {
    test('should create order successfully with COD', async () => {
      const orderData = {
        items: [
          {
            productId: testProduct._id.toString(),
            name: 'Test Product',
            price: 100000,
            quantity: 2,
            image: 'test.jpg'
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 200000,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 230000
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.status).toBe('Pending');
      expect(response.body.data.paymentMethod).toBe('COD');

      // Verify order was created in database
      const order = await Order.findById(response.body.data._id);
      expect(order).toBeTruthy();
      expect(order.userId.toString()).toBe(testUser._id.toString());
    });

    test('should return 400 if cart is empty', async () => {
      const orderData = {
        items: [],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 0,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 30000
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.message).toContain('Giỏ hàng trống');
    });

    test('should return 400 if product not in stock', async () => {
      // Update product to have 0 stock
      await Product.findByIdAndUpdate(testProduct._id, { countInStock: 0 });

      const orderData = {
        items: [
          {
            productId: testProduct._id.toString(),
            name: 'Test Product',
            price: 100000,
            quantity: 1,
            image: 'test.jpg'
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 100000,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 130000
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.message).toContain('không đủ số lượng');
    });

    test('should apply discount correctly', async () => {
      const orderData = {
        items: [
          {
            productId: testProduct._id.toString(),
            name: 'Test Product',
            price: 100000,
            quantity: 1,
            image: 'test.jpg'
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 100000,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 120000,
        discountAmount: 10000
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.discountApplied).toBe(true);
      expect(response.body.discountAmount).toBe(10000);
      expect(response.body.data.totalPrice).toBe(120000);
    });

    test('should return 401 without authentication', async () => {
      const orderData = {
        items: [
          {
            productId: testProduct._id.toString(),
            name: 'Test Product',
            price: 100000,
            quantity: 1,
            image: 'test.jpg'
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 100000,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 130000
      };

      await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);
    });

    test('should reduce inventory for COD orders', async () => {
      const initialStock = 10;
      const orderQuantity = 2;

      const orderData = {
        items: [
          {
            productId: testProduct._id.toString(),
            name: 'Test Product',
            price: 100000,
            quantity: orderQuantity,
            image: 'test.jpg'
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 100000 * orderQuantity,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 100000 * orderQuantity + 30000
      };

      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      // Verify inventory was reduced
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.countInStock).toBe(initialStock - orderQuantity);

      // Verify inventory record was created
      const inventory = await Inventory.findOne({ productId: testProduct._id });
      expect(inventory).toBeTruthy();
      expect(inventory.type).toBe('export');
      expect(inventory.quantity).toBe(orderQuantity);
    });
  });

  describe('GET /api/orders/my-orders', () => {
    test('should get user orders', async () => {
      // Create test order
      const order = await new Order({
        userId: testUser._id,
        items: [
          {
            productId: testProduct._id,
            name: 'Test Product',
            price: 100000,
            quantity: 1
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 100000,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 130000
      }).save();

      const response = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.some(o => o._id.toString() === order._id.toString())).toBe(true);
    });

    test('should return empty array if user has no orders', async () => {
      const response = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/orders/my-orders')
        .expect(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    test('should get order by id', async () => {
      const order = await new Order({
        userId: testUser._id,
        items: [
          {
            productId: testProduct._id,
            name: 'Test Product',
            price: 100000,
            quantity: 1
          }
        ],
        shippingAddress: {
          fullName: 'Test User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 100000,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 130000
      }).save();

      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body._id.toString()).toBe(order._id.toString());
      expect(response.body.userId.toString()).toBe(testUser._id.toString());
    });

    test('should return 404 for non-existent order', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/orders/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should return 403 if user tries to access other user order', async () => {
      // Create another user
      const hashedPassword = await bcrypt.hash('password123', 10);
      const otherUser = await new User({
        name: 'Other User',
        email: 'other@example.com',
        password: hashedPassword,
        emailVerified: true,
        role: 'customer'
      }).save();

      // Create order for other user
      const order = await new Order({
        userId: otherUser._id,
        items: [
          {
            productId: testProduct._id,
            name: 'Test Product',
            price: 100000,
            quantity: 1
          }
        ],
        shippingAddress: {
          fullName: 'Other User',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: 100000,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: 130000
      }).save();

      await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});

