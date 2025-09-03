const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../database.db'));

console.log('Initializing database...');

// Enable WAL mode and foreign keys
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

// Create folders table
db.run(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    parent_path TEXT,
    level INTEGER DEFAULT 0,
    created_at DATETIME,
    modified_at DATETIME,
    accessed_at DATETIME,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating folders table:', err);
  } else {
    console.log('Folders table created successfully');
  }
});

// Create files table
db.run(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER,
    name TEXT NOT NULL,
    extension TEXT,
    size INTEGER DEFAULT 0,
    created_at DATETIME,
    modified_at DATETIME,
    accessed_at DATETIME,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) {
    console.error('Error creating files table:', err);
  } else {
    console.log('Files table created successfully');
  }
});

// Create indexes for better performance
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path)',
  'CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_path)',
  'CREATE INDEX IF NOT EXISTS idx_folders_level ON folders(level)',
  'CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)',
  'CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension)',
  'CREATE INDEX IF NOT EXISTS idx_files_size ON files(size)'
];

indexes.forEach((indexSQL, i) => {
  db.run(indexSQL, (err) => {
    if (err) {
      console.error(`Error creating index ${i + 1}:`, err);
    } else {
      console.log(`Index ${i + 1} created successfully`);
    }
  });
});

// Note: FTS5 support varies by SQLite version and compilation
// For now, we'll use basic LIKE queries for search functionality

setTimeout(() => {
  console.log('Database initialization completed!');
  console.log('Tables created: folders, files');
  console.log('Indexes created for optimal performance');
  console.log('Note: Using standard SQLite with LIKE queries for search');
  db.close();
}, 1000);
