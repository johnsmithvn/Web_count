const jwt = require('jsonwebtoken');

// JWT Secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'media-db-secret-key-2025';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required', 
      message: 'Please login to access this resource' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid or expired token', 
        message: 'Please login again' 
      });
    }
    
    req.user = user; // Add user info to request
    next();
  });
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.is_admin === 1) {
    next();
  } else {
    res.status(403).json({ 
      error: 'Admin access required', 
      message: 'You need admin privileges to access this resource' 
    });
  }
};

// Middleware to extract user ID for queries
const extractUserId = (req, res, next) => {
  req.userId = req.user ? req.user.id : null;
  next();
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      username: user.username,
      is_admin: user.is_admin
    },
    JWT_SECRET,
    { expiresIn: '24h' } // Token expires in 24 hours
  );
};

// Verify token without middleware (for utility use)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  extractUserId,
  generateToken,
  verifyToken,
  JWT_SECRET
};
