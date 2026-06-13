# Media Database Manager — System Design Document

> **Version:** 1.1.0 | **Last Updated:** 2026-06-13 | **Status:** Verified against source code

## Overview

Local-only web application for managing and searching media file/folder databases. Replaces Excel/VBA workflows with a modern, web-based interface. Supports multi-user authentication with per-user data isolation.

## Architecture

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + Ant Design + Recharts | 18.3.1 / 5.27.2 / 3.1.2 |
| **Backend** | Node.js + Express | 4.18.2 |
| **Database** | SQLite (WAL mode) | sqlite3 5.1.6 |
| **Auth** | JWT + bcryptjs | jsonwebtoken 9.0.2 / bcryptjs 2.4.3 |
| **Communication** | RESTful API (JSON) | fetch API (no axios in runtime) |
| **Dev Tools** | concurrently + nodemon | 8.2.2 / 3.0.2 |

### Key Design Principles

1. **Local-Only Operation** — No cloud dependencies, all data on user's machine
2. **Manual Control** — User-triggered scans, no automatic background processes
3. **Dual Scan Modes** — Folder-only (structure) and file-detail (with metadata)
4. **Multi-User Isolation** — Each user sees only their own scanned data
5. **JWT Authentication** — Stateless auth with 24-hour token expiry

## Database Schema

### Entity Relationship

```
users (1) ──→ scans      (scan history, FK: user_id)
       ──→ folders    (folder metadata, FK: user_id)
                └──→ files (file metadata, FK: folder_id)
```

> **IMPORTANT:** `files` table has NO `user_id` column. File ownership is determined indirectly via `files.folder_id → folders.user_id`.

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,           -- bcrypt hashed
  email TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

### Scans Table

```sql
CREATE TABLE scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  root_path TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  folders_count INTEGER DEFAULT 0,
  files_count INTEGER DEFAULT 0,
  scan_options TEXT,                -- JSON: { maxDepth, includeExtensions, excludeExtensions }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Folders Table

```sql
CREATE TABLE folders (
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
);
```

### Files Table

```sql
CREATE TABLE files (
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
);
```

### Indexes

```sql
-- User & Auth
CREATE INDEX idx_users_username ON users(username);

-- Scan History
CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_status ON scans(status);

-- Folders (6 indexes)
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_path ON folders(path);
CREATE INDEX idx_folders_parent_path ON folders(parent_path);
CREATE INDEX idx_folders_level ON folders(level);
CREATE INDEX idx_folders_user_path ON folders(user_id, path);

-- Files (4 indexes)
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_extension ON files(extension);
CREATE INDEX idx_files_size ON files(size);
CREATE INDEX idx_files_name ON files(name);
```

## API Endpoints

### Authentication (Public — no token required)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/register` | User registration |
| `POST` | `/api/auth/login` | User login → returns JWT token |
| `GET` | `/api/health` | Server health check |

### Authentication (Protected — token required)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/auth/profile` | Get current user profile |
| `PUT` | `/api/auth/profile` | Update email/password |
| `POST` | `/api/auth/logout` | Logout confirmation |
| `GET` | `/api/auth/check` | Verify token validity |

### Scan Operations

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `POST` | `/api/scan/folder` | `{ rootPath, maxDepth }` | Scan directory structure only |
| `POST` | `/api/scan/file` | `{ rootPath, maxDepth, includeExtensions[], excludeExtensions[] }` | Scan files with full metadata |
| `GET` | `/api/scan/status` | — | Get scan status and counts |

### Search Operations

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/search` | Advanced search with filters (query, mode, caseSensitive, searchType, searchIn, extension, sizeMin/Max, dateFrom/To, ancestorLevels, ancestorMode, page, limit, limitEnabled, rootPaths) |
| `GET` | `/api/search/extensions` | Get all file extensions with counts |
| `GET` | `/api/search/folders/root` | Get top-level folders for tree rendering |
| `GET` | `/api/search/children/:encodedPath` | Get children folders for lazy loading |

### Statistics Operations

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/stats` | Full database statistics and analytics |
| `GET` | `/api/stats/path?path=` | Detailed stats for specific folder |
| `GET` | `/api/stats/root-paths` | Latest scan info per root path |
| `GET` | `/api/stats/root-paths/:encoded` | Scan history for specific root path |
| `GET` | `/api/stats/export?type=&format=csv` | Export to CSV |

### Delete Operations

| Method | Path | Purpose |
|--------|------|---------|
| `DELETE` | `/api/delete` | Delete data by root path & type |
| `DELETE` | `/api/delete/file/:id` | Delete individual file |
| `DELETE` | `/api/delete/all` | Delete all user data |
| `POST` | `/api/delete/preview` | Preview deletion counts |

### Add Operations

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/add/file` | Add file manually to database |
| `POST` | `/api/add/folder` | Add folder manually to database |

### Admin Operations (admin-only)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/users` | List all users with stats |
| `PUT` | `/api/admin/users/:id/password` | Reset user password |
| `DELETE` | `/api/admin/users/:id` | Delete user and all data |

## Frontend Architecture

### Component Structure (Actual)

```
client/src/
├── App.js                        # Main layout: Header + SearchPanel + Tabs
├── App.css                       # Custom styling
├── index.js                      # React entry point
├── components/
│   ├── AuthForm.js               # Login/Register form
│   ├── AuthForm.css              # Auth form styling
│   ├── Dashboard.js              # Statistics with Recharts charts
│   ├── SearchPanel.js            # Search controls + scan triggers (42KB, largest component)
│   ├── VirtualFolderTree.js      # TreeView with lazy loading + virtual scrolling
│   ├── FolderTableMode.js        # Folder data in table format
│   ├── FileMode.js               # File data table with pagination
│   ├── DeleteMode.js             # Delete files by name (contains/exact)
│   ├── AddFilesMode.js           # Manual file/folder addition
│   └── AdminUserManagement.js    # Admin user panel (admin-only tab)
├── contexts/
│   └── AuthContext.js            # Auth state (user, token, login, register, logout)
├── services/
│   └── api.js                    # ApiService class — centralized API communication
├── utils/
│   └── clipboard.js              # Copy-to-clipboard with fallback
├── layouts/                      # (empty — unused)
├── pages/                        # (empty — unused)
└── routes/                       # (empty — unused)
```

### Tab Structure

| Tab | Component | Visibility |
|-----|-----------|------------|
| Dashboard | `Dashboard.js` | All users |
| Folder Mode | `VirtualFolderTree.js` | All users |
| Folder Table | `FolderTableMode.js` | All users |
| File Mode | `FileMode.js` | All users |
| Delete Files | `DeleteMode.js` | All users |
| Add Files | `AddFilesMode.js` | All users |
| Admin | `AdminUserManagement.js` | Admin only |

## Authentication Flow

```
Client                          Server
  │                                │
  ├── POST /auth/login ──────────→ │ bcrypt.compare(password)
  │                                │ generateToken(user) → JWT
  │ ←── { token, user } ─────────┤
  │                                │
  │ localStorage.setItem('token')  │
  │                                │
  ├── GET /api/stats ────────────→ │ authenticateToken middleware
  │   Header: Bearer <token>       │ jwt.verify(token)
  │                                │ req.user = { id, username, is_admin }
  │                                │ extractUserId middleware
  │                                │ req.userId = req.user.id
  │                                │
  │ ←── { data filtered by user } ┤
```

## Performance Considerations

### Database
- SQLite WAL mode for concurrent read/write
- 13 strategic indexes
- Foreign key constraints (`PRAGMA foreign_keys = ON`)
- Promise-based sequential scan operations (v1.1.0)

### Frontend
- Pagination (configurable limit, can be disabled)
- Virtual scrolling for folder tree
- Lazy loading for child folders
- Debounced search input

### Scanning
- Configurable max depth (default: 10)
- Extension include/exclude filters
- Graceful error handling for permission-denied folders
- Async/await sequential execution (no race conditions)

## Ports & Access

| Service | Port | Access |
|---------|------|--------|
| Backend API | 5000 | `http://0.0.0.0:5000` |
| Frontend Dev | 5001 | `http://0.0.0.0:5001` |
| Production | 5000 | Serves built React from `client/build/` |

## Deployment

### Development

```bash
npm run install:all    # Install root + server + client dependencies
npm run db:init        # Initialize database + create admin user
npm run dev            # Start both servers concurrently
```

### Production

```bash
npm run build          # Build React frontend
npm start              # Start Express serving static build
# Access: http://localhost:5000
```

### Default Admin Account
- **Username:** admin
- **Password:** admin
