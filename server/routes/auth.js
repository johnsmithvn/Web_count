const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { username, password, email } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Username and password are required' 
      });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ 
        error: 'Invalid username', 
        message: 'Username must be at least 3 characters long' 
      });
    }
    
    if (password.length < 3) {
      return res.status(400).json({ 
        error: 'Invalid password', 
        message: 'Password must be at least 3 characters long' 
      });
    }
    
    // Check if user already exists
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, existingUser) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingUser) {
        return res.status(409).json({ 
          error: 'User already exists', 
          message: 'Username is already taken' 
        });
      }
      
      try {
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        db.run(`
          INSERT INTO users (username, password, email, is_admin, created_at, updated_at)
          VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [username, passwordHash, email || null], function(err) {
          if (err) {
            console.error('User creation error:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }
          
          // Get created user
          db.get('SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?', [this.lastID], (err, user) => {
            if (err) {
              console.error('User fetch error:', err);
              return res.status(500).json({ error: 'User created but failed to fetch details' });
            }
            
            // Generate token
            const token = generateToken(user);
            
            res.status(201).json({
              success: true,
              message: 'User registered successfully',
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                is_admin: user.is_admin,
                created_at: user.created_at
              },
              token
            });
          });
        });
      } catch (hashError) {
        console.error('Password hash error:', hashError);
        res.status(500).json({ error: 'Failed to process password' });
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { username, password } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials', 
        message: 'Username and password are required' 
      });
    }
    
    // Find user
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid credentials', 
          message: 'Username or password is incorrect' 
        });
      }
      
      try {
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
          return res.status(401).json({ 
            error: 'Invalid credentials', 
            message: 'Username or password is incorrect' 
          });
        }
        
        // Update last login
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        // Generate token
        const token = generateToken(user);
        
        res.json({
          success: true,
          message: 'Login successful',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.is_admin,
            created_at: user.created_at,
            last_login: user.last_login
          },
          token
        });
      } catch (compareError) {
        console.error('Password comparison error:', compareError);
        res.status(500).json({ error: 'Authentication failed' });
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  
  try {
    db.get('SELECT id, username, email, is_admin, created_at, last_login FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        console.error('Profile fetch error:', err);
        return res.status(500).json({ error: 'Failed to fetch profile' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        success: true,
        user
      });
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile', details: error.message });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Get current user data
    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err) {
        console.error('User fetch error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      try {
        let updateFields = [];
        let updateValues = [];
        
        // Update email if provided
        if (email !== undefined) {
          updateFields.push('email = ?');
          updateValues.push(email);
        }
        
        // Update password if provided
        if (newPassword) {
          if (!currentPassword) {
            return res.status(400).json({ 
              error: 'Current password required', 
              message: 'Current password is required to change password' 
            });
          }
          
          // Verify current password
          const passwordMatch = await bcrypt.compare(currentPassword, user.password);
          if (!passwordMatch) {
            return res.status(401).json({ 
              error: 'Invalid current password', 
              message: 'Current password is incorrect' 
            });
          }
          
          if (newPassword.length < 3) {
            return res.status(400).json({ 
              error: 'Invalid new password', 
              message: 'New password must be at least 3 characters long' 
            });
          }
          
          // Hash new password
          const newPasswordHash = await bcrypt.hash(newPassword, 10);
          updateFields.push('password = ?');
          updateValues.push(newPasswordHash);
        }
        
        if (updateFields.length === 0) {
          return res.status(400).json({ 
            error: 'No updates provided', 
            message: 'No valid fields to update' 
          });
        }
        
        // Add updated_at
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(userId);
        
        const updateSQL = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        
        db.run(updateSQL, updateValues, function(err) {
          if (err) {
            console.error('Profile update error:', err);
            return res.status(500).json({ error: 'Failed to update profile' });
          }
          
          // Fetch updated user data
          db.get('SELECT id, username, email, is_admin, created_at, updated_at FROM users WHERE id = ?', [userId], (err, updatedUser) => {
            if (err) {
              console.error('Updated user fetch error:', err);
              return res.status(500).json({ error: 'Profile updated but failed to fetch new data' });
            }
            
            res.json({
              success: true,
              message: 'Profile updated successfully',
              user: updatedUser
            });
          });
        });
      } catch (updateError) {
        console.error('Profile update processing error:', updateError);
        res.status(500).json({ error: 'Failed to process profile update' });
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed', details: error.message });
  }
});

// Logout (client-side token removal, server just confirms)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Check authentication status
router.get('/check', authenticateToken, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      is_admin: req.user.is_admin
    }
  });
});

module.exports = router;
