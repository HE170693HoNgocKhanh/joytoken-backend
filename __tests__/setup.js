// Test setup file
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Mock environment variables for testing
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.DB_CONNECT = process.env.DB_CONNECT || 'mongodb://localhost:27017/joytoken-test';

// Global test setup
beforeAll(async () => {
  // Connect to test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.DB_CONNECT, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
});

// Global test teardown
afterAll(async () => {
  // Clean up: drop test database
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
});

// Clean up collections before each test
beforeEach(async () => {
  // Delete in order to avoid foreign key constraints
  const collections = mongoose.connection.collections;
  const deleteOrder = ['orders', 'reviews', 'products', 'categories', 'users', 'inventories'];
  
  for (const collectionName of deleteOrder) {
    if (collections[collectionName]) {
      try {
        await collections[collectionName].deleteMany({});
      } catch (error) {
        // Ignore errors if collection doesn't exist
      }
    }
  }
  
  // Also delete any other collections
  for (const key in collections) {
    if (!deleteOrder.includes(key)) {
      try {
        await collections[key].deleteMany({});
      } catch (error) {
        // Ignore errors
      }
    }
  }
  
  // Wait a bit to ensure cleanup completes
  await new Promise(resolve => setTimeout(resolve, 100));
});

