const Product = require('../../../src/models/Product');
const Category = require('../../../src/models/Category');
const User = require('../../../src/models/User');

describe('Product Model', () => {
  let category;
  let seller;

  beforeEach(async () => {
    // Clean up first
    await Product.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Create test category with unique name
    category = new Category({
      name: `Test Category ${Date.now()}`,
      description: 'Test Description'
    });
    await category.save();

    // Create test seller with unique email
    seller = new User({
      name: 'Test Seller',
      email: `seller${Date.now()}@example.com`,
      password: 'password123',
      role: 'seller',
      emailVerified: true
    });
    await seller.save();
  });

  describe('Product Schema Validation', () => {
    test('should create a new product with valid data', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10
      };

      const product = new Product(productData);
      const savedProduct = await product.save();

      expect(savedProduct._id).toBeDefined();
      expect(savedProduct.name).toBe(productData.name);
      expect(savedProduct.description).toBe(productData.description);
      expect(savedProduct.price).toBe(productData.price);
      expect(savedProduct.countInStock).toBe(productData.countInStock);
      expect(savedProduct.rating).toBe(0);
      expect(savedProduct.numReviews).toBe(0);
      expect(savedProduct.isActive).toBe(true);
    });

    test('should require name field', async () => {
      const product = new Product({
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10
      });

      await expect(product.save()).rejects.toThrow();
    });

    test('should require description field', async () => {
      const product = new Product({
        name: 'Test Product',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10
      });

      await expect(product.save()).rejects.toThrow();
    });

    test('should require price field', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        category: category._id,
        seller: seller._id,
        countInStock: 10
      });

      await expect(product.save()).rejects.toThrow();
    });

    test('should require category field', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        seller: seller._id,
        countInStock: 10
      });

      await expect(product.save()).rejects.toThrow();
    });

    test('should require seller field', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        countInStock: 10
      });

      await expect(product.save()).rejects.toThrow();
    });

    test('should not allow negative price', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: -100,
        category: category._id,
        seller: seller._id,
        countInStock: 10
      });

      await expect(product.save()).rejects.toThrow();
    });

    test('should not allow negative countInStock', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: -10
      });

      await expect(product.save()).rejects.toThrow();
    });

    test('should default countInStock to 0', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id
      });

      const savedProduct = await product.save();
      expect(savedProduct.countInStock).toBe(0);
    });

    test('should default isActive to true', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10
      });

      const savedProduct = await product.save();
      expect(savedProduct.isActive).toBe(true);
    });

    test('should default personalize to false', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10
      });

      const savedProduct = await product.save();
      expect(savedProduct.personalize).toBe(false);
    });
  });

  describe('Product Variants', () => {
    test('should allow product variants', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10,
        variants: [
          {
            size: 'Small',
            color: 'Red',
            price: 90000,
            countInStock: 5
          },
          {
            size: 'Large',
            color: 'Blue',
            price: 120000,
            countInStock: 3
          }
        ]
      });

      const savedProduct = await product.save();
      expect(savedProduct.variants).toHaveLength(2);
      expect(savedProduct.variants[0].size).toBe('Small');
      expect(savedProduct.variants[1].size).toBe('Large');
    });
  });

  describe('Product Tags and Events', () => {
    test('should allow tags and events', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10,
        tags: ['sinh nhật', 'quà tặng', 'dễ thương'],
        events: ['birthday', 'valentine']
      });

      const savedProduct = await product.save();
      expect(savedProduct.tags).toHaveLength(3);
      expect(savedProduct.events).toHaveLength(2);
      expect(savedProduct.tags).toContain('sinh nhật');
      expect(savedProduct.events).toContain('birthday');
    });
  });

  describe('Product Labels', () => {
    test('should allow product labels', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test Description',
        price: 100000,
        category: category._id,
        seller: seller._id,
        countInStock: 10,
        label: 'Sale',
        isBestSeller: true,
        isNew: false
      });

      const savedProduct = await product.save();
      expect(savedProduct.label).toBe('Sale');
      expect(savedProduct.isBestSeller).toBe(true);
      expect(savedProduct.isNew).toBe(false);
    });
  });
});

