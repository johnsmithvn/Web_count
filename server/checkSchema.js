const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database schema...');

// Check files table schema
db.all("PRAGMA table_info(files)", (err, rows) => {
  if (err) {
    console.error('Error checking files table:', err);
  } else {
    console.log('\n=== FILES TABLE SCHEMA ===');
    rows.forEach(row => {
      console.log(`${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
    });
  }
});

// Check folders table schema
db.all("PRAGMA table_info(folders)", (err, rows) => {
  if (err) {
    console.error('Error checking folders table:', err);
  } else {
    console.log('\n=== FOLDERS TABLE SCHEMA ===');
    rows.forEach(row => {
      console.log(`${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
    });
  }
});

// Check users table schema
db.all("PRAGMA table_info(users)", (err, rows) => {
  if (err) {
    console.error('Error checking users table:', err);
  } else {
    console.log('\n=== USERS TABLE SCHEMA ===');
    rows.forEach(row => {
      console.log(`${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
    });
  }
});

setTimeout(() => {
  db.close();
}, 1000);
