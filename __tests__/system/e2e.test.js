const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../helpers/app');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const Order = require('../../src/models/Order');
const bcrypt = require('bcryptjs');

const app = createApp();

describe('E2E System Tests - Complete User Flows', () => {
  let customerToken;
  let adminToken;
  let testCategory;
  let testProduct;
  let testCustomer;

  beforeAll(async () => {
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

    // Create test category
    testCategory = await new Category({
      name: 'Test Category',
      description: 'Test Description'
    }).save();

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      emailVerified: true,
      role: 'admin'
    }).save();

    // Create seller
    const sellerPassword = await bcrypt.hash('seller123', 10);
    const seller = await new User({
      name: 'Seller User',
      email: 'seller@example.com',
      password: sellerPassword,
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

    // Login as admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Complete E-Commerce Flow', () => {
    test('Flow 1: User Registration → Login → Browse Products → View Product → Add to Cart → Place Order', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Customer',
          email: 'newcustomer@example.com',
          password: 'password123'
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('email', 'newcustomer@example.com');

      // Step 2: Verify email (simulate OTP verification)
      // Note: In real scenario, user would verify email with OTP
      // For testing, we'll manually verify the email
      const newUser = await User.findOne({ email: 'newcustomer@example.com' });
      if (!newUser) {
        throw new Error('User not found after registration');
      }
      newUser.emailVerified = true;
      await newUser.save();

      // Step 3: Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newcustomer@example.com',
          password: 'password123'
        })
        .expect(200);

      customerToken = loginResponse.body.token;
      expect(customerToken).toBeDefined();

      // Step 4: Browse products
      const productsResponse = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(productsResponse.body.products.length).toBeGreaterThan(0);

      // Step 5: View product details
      const productResponse = await request(app)
        .get(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(productResponse.body.name).toBe('Test Product');
      expect(productResponse.body.price).toBe(100000);

      // Step 6: Create order (simulate adding to cart and placing order)
      const orderData = {
        items: [
          {
            productId: testProduct._id.toString(),
            name: testProduct.name,
            price: testProduct.price,
            quantity: 2,
            image: testProduct.image
          }
        ],
        shippingAddress: {
          fullName: 'New Customer',
          address: '123 Test Street',
          city: 'Ho Chi Minh',
          postalCode: '70000',
          country: 'Vietnam',
          phone: '0123456789'
        },
        paymentMethod: 'COD',
        itemsPrice: testProduct.price * 2,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: testProduct.price * 2 + 30000
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      expect(orderResponse.body).toHaveProperty('_id');
      expect(orderResponse.body.status).toBe('Pending');
      expect(orderResponse.body.items.length).toBe(1);

      // Step 7: View order history
      const ordersResponse = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(ordersResponse.body.length).toBeGreaterThan(0);
      expect(ordersResponse.body.some(o => 
        o._id.toString() === orderResponse.body._id.toString()
      )).toBe(true);
    });

    test('Flow 2: Admin creates product → Customer views → Customer places order → Admin manages order', async () => {
      // Step 1: Admin creates new product
      const newProductData = {
        name: 'Admin Created Product',
        description: 'Product created by admin',
        price: 150000,
        category: testCategory._id.toString(),
        countInStock: 5
      };

      const createProductResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newProductData)
        .expect(201);

      const createdProductId = createProductResponse.body._id;

      // Step 2: Customer views the product
      const productResponse = await request(app)
        .get(`/api/products/${createdProductId}`)
        .expect(200);

      expect(productResponse.body.name).toBe(newProductData.name);

      // Step 3: Customer places order
      // First, create a customer and login
      const customerPassword = await bcrypt.hash('customer123', 10);
      const customer = await new User({
        name: 'Test Customer',
        email: 'customer@example.com',
        password: customerPassword,
        emailVerified: true,
        role: 'customer'
      }).save();

      const customerLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'customer@example.com', password: 'customer123' })
        .expect(200);

      const customerAuthToken = customerLogin.body.token;

      const orderData = {
        items: [
          {
            productId: createdProductId,
            name: newProductData.name,
            price: newProductData.price,
            quantity: 1,
            image: ''
          }
        ],
        shippingAddress: {
          fullName: 'Test Customer',
          address: '456 Test Avenue',
          city: 'Hanoi',
          postalCode: '10000',
          country: 'Vietnam',
          phone: '0987654321'
        },
        paymentMethod: 'COD',
        itemsPrice: newProductData.price,
        taxPrice: 0,
        shippingPrice: 30000,
        totalPrice: newProductData.price + 30000
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerAuthToken}`)
        .send(orderData)
        .expect(201);

      const orderId = orderResponse.body._id;

      // Step 4: Admin views all orders
      const adminOrdersResponse = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminOrdersResponse.body.length).toBeGreaterThan(0);

      // Step 5: Admin updates order status
      const updateOrderResponse = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Processing' })
        .expect(200);

      expect(updateOrderResponse.body.status).toBe('Processing');
    });

    test('Flow 3: Product search and filtering', async () => {
      // Create multiple products with different attributes
      const sellerPassword = await bcrypt.hash('seller123', 10);
      const seller = await new User({
        name: 'Seller',
        email: 'seller@test.com',
        password: sellerPassword,
        emailVerified: true,
        role: 'seller'
      }).save();

      await Product.insertMany([
        {
          name: 'Product A - Red',
          description: 'Red product',
          price: 50000,
          category: testCategory._id,
          seller: seller._id,
          countInStock: 5,
          isActive: true
        },
        {
          name: 'Product B - Blue',
          description: 'Blue product',
          price: 150000,
          category: testCategory._id,
          seller: seller._id,
          countInStock: 3,
          isActive: true
        },
        {
          name: 'Product C - Green',
          description: 'Green product',
          price: 200000,
          category: testCategory._id,
          seller: seller._id,
          countInStock: 10,
          isActive: true
        }
      ]);

      // Test search by name
      const searchResponse = await request(app)
        .get('/api/products?search=Red')
        .expect(200);

      // Check response format - could be { products: [...] } or { data: [...] }
      const products = searchResponse.body.products || searchResponse.body.data || [];
      expect(Array.isArray(products)).toBe(true);
      expect(products.some(p => 
        p.name && p.name.includes('Red')
      )).toBe(true);

      // Test price filtering
      const priceFilterResponse = await request(app)
        .get('/api/products?minPrice=100000&maxPrice=180000')
        .expect(200);

      expect(priceFilterResponse.body.products.every(p => 
        p.price >= 100000 && p.price <= 180000
      )).toBe(true);

      // Test sorting
      const sortResponse = await request(app)
        .get('/api/products?sort=price_asc')
        .expect(200);

      const prices = sortResponse.body.products.map(p => p.price);
      const sortedPrices = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sortedPrices);
    });
  });
});

