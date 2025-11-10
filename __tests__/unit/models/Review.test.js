const Review = require('../../../src/models/Review');
const User = require('../../../src/models/User');
const Product = require('../../../src/models/Product');
const Category = require('../../../src/models/Category');

describe('Review Model - Detailed Tests', () => {
  let testUser;
  let testProduct;

  beforeEach(async () => {
    // Clean up first
    await Review.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Create test user with unique email
    const timestamp = Date.now() + Math.random();
    testUser = new User({
      name: 'Test User',
      email: `test${timestamp}@example.com`,
      password: 'password123',
      emailVerified: true,
      role: 'customer'
    });
    await testUser.save();

    // Create test category and product with unique name
    const category = new Category({
      name: `Test Category ${timestamp}`,
      description: 'Test Description'
    });
    await category.save();
    await new Promise(resolve => setTimeout(resolve, 50));

    const seller = new User({
      name: 'Seller',
      email: `seller${timestamp}@example.com`,
      password: 'password123',
      emailVerified: true,
      role: 'seller'
    });
    await seller.save();

    testProduct = new Product({
      name: 'Test Product',
      description: 'Test Description',
      price: 100000,
      category: category._id,
      seller: seller._id,
      countInStock: 10
    });
    await testProduct.save();
  });

  describe('Review Schema Validation', () => {
    test('should create review with valid data', async () => {
      const reviewData = {
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Great product!'
      };

      const review = new Review(reviewData);
      const savedReview = await review.save();

      expect(savedReview._id).toBeDefined();
      expect(savedReview.productId.toString()).toBe(testProduct._id.toString());
      expect(savedReview.userId.toString()).toBe(testUser._id.toString());
      expect(savedReview.rating).toBe(5);
      expect(savedReview.comment).toBe('Great product!');
      expect(savedReview.isVerified).toBe(false);
    });

    test('should require productId', async () => {
      const review = new Review({
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Great product!'
      });

      await expect(review.save()).rejects.toThrow();
    });

    test('should require userId', async () => {
      const review = new Review({
        productId: testProduct._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Great product!'
      });

      await expect(review.save()).rejects.toThrow();
    });

    test('should require userName', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        rating: 5,
        comment: 'Great product!'
      });

      await expect(review.save()).rejects.toThrow();
    });

    test('should require rating', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        comment: 'Great product!'
      });

      await expect(review.save()).rejects.toThrow();
    });

    test('should require comment', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5
      });

      await expect(review.save()).rejects.toThrow();
    });

    test('should accept valid ratings (1-5)', async () => {
      for (let rating = 1; rating <= 5; rating++) {
        const review = new Review({
          productId: testProduct._id,
          userId: testUser._id,
          userName: 'Test User',
          rating,
          comment: `Rating ${rating}`
        });

        const savedReview = await review.save();
        expect(savedReview.rating).toBe(rating);
        await Review.findByIdAndDelete(savedReview._id);
      }
    });

    test('should reject rating less than 1', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 0,
        comment: 'Invalid rating'
      });

      await expect(review.save()).rejects.toThrow();
    });

    test('should reject rating greater than 5', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 6,
        comment: 'Invalid rating'
      });

      await expect(review.save()).rejects.toThrow();
    });

    test('should support images array', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Great product!',
        images: ['image1.jpg', 'image2.jpg', 'image3.jpg']
      });

      const savedReview = await review.save();
      expect(savedReview.images).toHaveLength(3);
      expect(savedReview.images[0]).toBe('image1.jpg');
    });

    test('should default isVerified to false', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Great product!'
      });

      const savedReview = await review.save();
      expect(savedReview.isVerified).toBe(false);
    });

    test('should enforce unique constraint on productId and userId', async () => {
      const review1 = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'First review'
      });
      await review1.save();

      const review2 = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 4,
        comment: 'Second review'
      });

      await expect(review2.save()).rejects.toThrow();
    });

    test('should allow multiple reviews for same product by different users', async () => {
      const user2 = new User({
        name: 'User 2',
        email: 'user2@example.com',
        password: 'password123',
        emailVerified: true,
        role: 'customer'
      });
      await user2.save();

      const review1 = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Review 1'
      });
      await review1.save();

      const review2 = new Review({
        productId: testProduct._id,
        userId: user2._id,
        userName: 'User 2',
        rating: 4,
        comment: 'Review 2'
      });
      const savedReview2 = await review2.save();

      expect(savedReview2._id).toBeDefined();
      expect(savedReview2.userId.toString()).toBe(user2._id.toString());
    });

    test('should allow same user to review different products', async () => {
      // Use the category and seller from beforeEach
      const timestamp = Date.now();
      const category = new Category({
        name: `Test Category ${timestamp}`,
        description: 'Test Description'
      });
      await category.save();
      
      const seller = new User({
        name: 'Seller',
        email: `seller${timestamp}@example.com`,
        password: 'password123',
        emailVerified: true,
        role: 'seller'
      });
      await seller.save();
      
      const product2 = new Product({
        name: 'Product 2',
        description: 'Description 2',
        price: 200000,
        category: category._id,
        seller: seller._id,
        countInStock: 5
      });
      await product2.save();

      const review1 = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Review 1'
      });
      await review1.save();

      const review2 = new Review({
        productId: product2._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 4,
        comment: 'Review 2'
      });
      const savedReview2 = await review2.save();

      expect(savedReview2._id).toBeDefined();
      expect(savedReview2.productId.toString()).toBe(product2._id.toString());
    });

    test('should have timestamps', async () => {
      const review = new Review({
        productId: testProduct._id,
        userId: testUser._id,
        userName: 'Test User',
        rating: 5,
        comment: 'Great product!'
      });

      const savedReview = await review.save();
      expect(savedReview.createdAt).toBeDefined();
      expect(savedReview.updatedAt).toBeDefined();
    });
  });
});

