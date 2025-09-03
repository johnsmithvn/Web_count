const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Conditionally serve React build files only if they exist
const buildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
}

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

// Enable WAL mode for better performance
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

// Make db available to routes
app.locals.db = db;

// Import routes
const scanRoutes = require('./routes/scan');
const searchRoutes = require('./routes/search');
const statsRoutes = require('./routes/stats');
const deleteRoutes = require('./routes/delete');
const addRoutes = require('./routes/add');

// Use routes
app.use('/api/scan', scanRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/delete', deleteRoutes);
app.use('/api/add', addRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Media Database Server is running' });
});

// Serve React app for any non-API routes (only if build exists)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/build', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      message: 'Media Database API Server', 
      status: 'Development Mode',
      frontend: 'Run React dev server separately on port 3001',
      api_health: '/api/health'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, db };
