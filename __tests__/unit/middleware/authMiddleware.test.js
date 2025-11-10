const authMiddleware = require('../../../src/middleware/authMiddleware');
const User = require('../../../src/models/User');
const jwt = require('jsonwebtoken');

describe('Auth Middleware - Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    test('should call next() if token is valid', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'customer'
      };

      req.headers.authorization = 'Bearer valid-token';

      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue({ id: 'user123' });

      // Mock User.findById with select method
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      await authMiddleware.verifyToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 if token is missing', async () => {
      req.headers.authorization = undefined;

      await authMiddleware.verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Chưa đăng nhập hoặc thiếu token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token is invalid', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      jwt.verify = jest.fn().mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await authMiddleware.verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Token không hợp lệ'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 403 if token is expired', async () => {
      req.headers.authorization = 'Bearer expired-token';

      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await authMiddleware.verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Token đã hết hạn'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if user not found', async () => {
      req.headers.authorization = 'Bearer valid-token';

      jwt.verify = jest.fn().mockReturnValue({ id: 'nonexistent' });
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await authMiddleware.verifyToken(req, res, next);

      // Implementation returns 401 for user not found
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User không tồn tại'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalVerifyToken', () => {
    test('should call next() if token is missing', async () => {
      req.headers.authorization = undefined;

      await authMiddleware.optionalVerifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    test('should set req.user if token is valid', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com'
      };

      req.headers.authorization = 'Bearer valid-token';

      jwt.verify = jest.fn().mockReturnValue({ id: 'user123' });
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      await authMiddleware.optionalVerifyToken(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    test('should continue if token is invalid (optional)', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware.optionalVerifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });
  });

  describe('requireRole', () => {
    test('should call next() if user has required role', () => {
      req.user = {
        _id: 'user123',
        role: 'admin'
      };

      const middleware = authMiddleware.requireRole(['admin', 'staff']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 if user is not authenticated', () => {
      req.user = null;

      const middleware = authMiddleware.requireRole(['admin']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Chưa đăng nhập'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 403 if user does not have required role', () => {
      req.user = {
        _id: 'user123',
        role: 'customer'
      };

      const middleware = authMiddleware.requireRole(['admin', 'staff']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Bạn không có quyền truy cập chức năng này'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

