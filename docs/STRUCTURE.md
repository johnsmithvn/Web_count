# Media Database Manager — Project Structure

> **Version:** 1.1.0 | **Last Updated:** 2026-06-13

## Root Directory

```
media-database-manager/
├── package.json                  # Root config — scripts, version (v1.1.0)
├── package-lock.json             # Root lockfile (concurrently)
├── .env.development              # Dev environment variables
├── .gitignore                    # Git ignore rules
├── README.md                     # Project overview
├── CHANGELOG.md                  # Full version history
│
├── docs/                         # 📚 Project documentation
│   ├── SYSTEM_DESIGN.md          # Architecture & design decisions
│   ├── DATABASE.md               # Schema, columns, indexes, patterns
│   ├── API.md                    # Full API endpoint reference
│   ├── RULES.md                  # AI agent coding rules
│   └── STRUCTURE.md              # This file
│
├── server/                       # 🖥️ Backend (Node.js + Express)
│   ├── package.json              # Server dependencies
│   ├── index.js                  # Express app setup, middleware, routes
│   ├── database.db               # SQLite database file (gitignored)
│   ├── database.db-shm           # SQLite shared memory (WAL mode)
│   ├── database.db-wal           # SQLite write-ahead log
│   ├── checkSchema.js            # Utility: print current DB schema
│   ├── middleware/
│   │   └── auth.js               # JWT auth middleware (authenticateToken,
│   │                             #   extractUserId, requireAdmin, generateToken)
│   ├── routes/
│   │   ├── auth.js               # Auth: register, login, profile, logout
│   │   ├── scan.js               # Scan: folder-only, file-detail, status
│   │   ├── search.js             # Search: advanced, extensions, tree
│   │   ├── stats.js              # Stats: dashboard, paths, export CSV
│   │   ├── delete.js             # Delete: by path, by file, all, preview
│   │   ├── add.js                # Add: manual file/folder insertion
│   │   └── admin.js              # Admin: user management (admin-only)
│   └── scripts/
│       └── initDb.js             # DB initialization (tables, indexes, admin)
│
├── client/                       # 🌐 Frontend (React 18 + Ant Design 5)
│   ├── package.json              # Client dependencies
│   ├── .env                      # Client env (PORT=5001)
│   ├── public/                   # Static assets (index.html, favicon)
│   ├── build/                    # Production build output
│   └── src/
│       ├── index.js              # React entry point
│       ├── App.js                # Main layout: Header + SearchPanel + Tabs
│       ├── App.css               # Global custom styles
│       ├── components/
│       │   ├── AuthForm.js       # Login/Register UI (+ AuthForm.css)
│       │   ├── Dashboard.js      # Charts & statistics (20KB)
│       │   ├── SearchPanel.js    # Search + scan controls (42KB, largest)
│       │   ├── VirtualFolderTree.js  # Lazy-loaded folder tree (18KB)
│       │   ├── FolderTableMode.js    # Folder data as table (12KB)
│       │   ├── FileMode.js       # File listing table (8KB)
│       │   ├── DeleteMode.js     # Delete by file name (10KB)
│       │   ├── AddFilesMode.js   # Manual add file/folder (8KB)
│       │   └── AdminUserManagement.js  # Admin user panel (8KB)
│       ├── contexts/
│       │   └── AuthContext.js    # Auth state management
│       ├── services/
│       │   └── api.js            # ApiService — centralized API layer
│       ├── utils/
│       │   └── clipboard.js      # Copy-to-clipboard with fallback
│       ├── layouts/              # (empty — unused)
│       ├── pages/                # (empty — unused)
│       └── routes/               # (empty — unused)
│
└── .github/
    └── copilot-instructions.md   # GitHub Copilot project context
```

## File Size Distribution (Server Routes)

| File | Size | Complexity |
|------|------|------------|
| `search.js` | 23KB | High — 5 endpoints, word-based search, ancestor tree |
| `stats.js` | 19KB | High — 10-level nested callbacks, CSV export |
| `scan.js` | 11KB | Medium — async/await rewrite (v1.1.0) |
| `delete.js` | 11KB | Medium — 4 endpoints with Promise.all |
| `auth.js` | 10KB | Medium — register, login, profile, logout |
| `add.js` | 7KB | Low — 2 simple endpoints |
| `admin.js` | 6KB | Low — 3 endpoints with transactions |

## File Size Distribution (Client Components)

| Component | Size | Description |
|-----------|------|-------------|
| `SearchPanel.js` | 42KB | **Largest** — search, scan, filter controls |
| `Dashboard.js` | 20KB | Charts (Recharts), statistics cards |
| `VirtualFolderTree.js` | 18KB | Virtual scrolling tree |
| `FolderTableMode.js` | 12KB | Folder table view |
| `DeleteMode.js` | 10KB | File deletion interface |
| `AddFilesMode.js` | 8KB | Manual file/folder addition |
| `AdminUserManagement.js` | 8KB | Admin panel |
| `FileMode.js` | 8KB | File listing table |
| `AuthForm.js` | 6KB | Login/register form |

## Empty Directories

| Path | Notes |
|------|-------|
| `client/src/layouts/` | Unused — App uses flat Layout from Ant Design |
| `client/src/pages/` | Unused — Single-page app with Tabs, no routing |
| `client/src/routes/` | Unused — No React Router |
