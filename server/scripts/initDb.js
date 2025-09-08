const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../database.db');

console.log('Initializing database with authentication...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('Database connection established');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON', (err) => {
  if (err) {
    console.error('Error enabling foreign keys:', err);
  } else {
    console.log('Foreign keys enabled');
  }
});

// Create users table first
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )
`, (err) => {
  if (err) {
    console.error('Error creating users table:', err);
  } else {
    console.log('✅ Users table created successfully');
  }
});

// Create scans table
db.run(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    root_path TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    folders_count INTEGER DEFAULT 0,
    files_count INTEGER DEFAULT 0,
    scan_options TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) {
    console.error('Error creating scans table:', err);
  } else {
    console.log('✅ Scans table created successfully');
  }
});

// Create folders table
db.run(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_path TEXT,
    level INTEGER DEFAULT 0,
    created_at DATETIME,
    modified_at DATETIME,
    accessed_at DATETIME,
    scanned_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) {
    console.error('Error creating folders table:', err);
  } else {
    console.log('✅ Folders table created successfully');
  }
});

// Create files table
db.run(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    extension TEXT,
    size INTEGER,
    folder_id INTEGER,
    created_at DATETIME,
    modified_at DATETIME,
    accessed_at DATETIME,
    scanned_at DATETIME,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
  )
`, (err) => {
  if (err) {
    console.error('Error creating files table:', err);
  } else {
    console.log('✅ Files table created successfully');
  }
});

// Create indexes
const indexes = [
  { name: 'idx_users_username', sql: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)' },
  { name: 'idx_scans_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id)' },
  { name: 'idx_scans_status', sql: 'CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status)' },
  { name: 'idx_folders_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)' },
  { name: 'idx_folders_path', sql: 'CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path)' },
  { name: 'idx_folders_parent_path', sql: 'CREATE INDEX IF NOT EXISTS idx_folders_parent_path ON folders(parent_path)' },
  { name: 'idx_folders_level', sql: 'CREATE INDEX IF NOT EXISTS idx_folders_level ON folders(level)' },
  { name: 'idx_folders_user_path', sql: 'CREATE INDEX IF NOT EXISTS idx_folders_user_path ON folders(user_id, path)' },
  { name: 'idx_files_folder_id', sql: 'CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id)' },
  { name: 'idx_files_extension', sql: 'CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension)' },
  { name: 'idx_files_size', sql: 'CREATE INDEX IF NOT EXISTS idx_files_size ON files(size)' },
  { name: 'idx_files_name', sql: 'CREATE INDEX IF NOT EXISTS idx_files_name ON files(name)' }
];

indexes.forEach((index, i) => {
  setTimeout(() => {
    db.run(index.sql, (err) => {
      if (err) {
        console.error(`❌ Error creating index ${index.name}:`, err);
      } else {
        console.log(`✅ Index ${index.name} created successfully`);
      }
    });
  }, (i + 1) * 100);
});

// Create admin user after a delay to ensure tables are created
setTimeout(() => {
  console.log('Creating admin user...');
  bcrypt.hash('admin', 10, (err, hash) => {
    if (err) {
      console.error('❌ Error hashing password:', err);
      return;
    }
    
    db.run(`
      INSERT OR IGNORE INTO users (username, password, is_admin, created_at)
      VALUES (?, ?, 1, ?)
    `, ['admin', hash, new Date().toISOString()], (err) => {
      if (err) {
        console.error('❌ Error creating admin user:', err);
      } else {
        console.log('✅ Admin user created: admin/admin');
      }
    });
  });
}, 2000);

setTimeout(() => {
  console.log('\n🎉 Database initialization completed!');
  console.log('📊 Tables created: users, scans, folders, files');
  console.log('🚀 Indexes created for optimal performance');
  console.log('👤 Admin account: admin/admin');
  console.log('🔐 Using bcrypt for password hashing and JWT for sessions');
  db.close();
}, 3500);
