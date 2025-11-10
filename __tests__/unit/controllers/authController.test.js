const authController = require('../../../src/controllers/authController');
const User = require('../../../src/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../../src/utils/mailer', () => ({
  sendOtp: jest.fn().mockResolvedValue(true)
}));

describe('Auth Controller - Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock User.findOne to return null (email not exists)
      User.findOne = jest.fn().mockResolvedValue(null);
      User.prototype.save = jest.fn().mockResolvedValue({
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: false
      });

      await authController.register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Đăng ký thành công'),
          email: 'test@example.com'
        })
      );
    });

    test('should return error if email already exists', async () => {
      req.body = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'password123'
      };

      // Mock User.findOne to return existing user
      User.findOne = jest.fn().mockResolvedValue({
        _id: 'existing123',
        email: 'existing@example.com'
      });

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email đã được đăng ký.'
      });
    });

    test('should return error if required fields are missing', async () => {
      req.body = {
        name: 'Test User'
        // Missing email and password
      };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vui lòng nhập đầy đủ thông tin.'
      });
    });
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock User.findOne to return user with hashed password
      User.findOne = jest.fn().mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
        password: hashedPassword,
        emailVerified: true,
        role: 'customer',
        name: 'Test User'
      });

      // Mock jwt.sign
      const mockToken = 'mock-jwt-token';
      jwt.sign = jest.fn().mockReturnValue(mockToken);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: mockToken,
          user: expect.objectContaining({
            email: 'test@example.com'
          })
        })
      );
    });

    test('should return error if user not found', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      User.findOne = jest.fn().mockResolvedValue(null);

      await authController.login(req, res);

      // Implementation returns 404 for user not found
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email không tồn tại.'
      });
    });

    test('should return error if password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      User.findOne = jest.fn().mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
        password: hashedPassword,
        emailVerified: true
      });

      await authController.login(req, res);

      // Implementation returns 400 for wrong password
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Mật khẩu không đúng.'
      });
    });

    test('should return error if email not verified', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      User.findOne = jest.fn().mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
        password: hashedPassword,
        emailVerified: false
      });

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email chưa được xác thực. Vui lòng xác thực trước khi đăng nhập.'
      });
    });
  });
});

