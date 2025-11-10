// Helper to create app instance for testing
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const routes = require('../../src/routers');

const createApp = () => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'test-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false },
    })
  );

  // Serve static files (uploads)
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

  // Route test
  app.get('/', (req, res) => {
    res.send('🚀 Server running successfully!');
  });

  // Import all routers
  app.use('/api', routes);

  return app;
};

module.exports = createApp;

