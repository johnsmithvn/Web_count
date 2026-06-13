# Media Database Manager — API Reference

> **Version:** 1.1.0 | **Last Updated:** 2026-06-13 | **Base URL:** `http://localhost:5000/api`

## Authentication

All protected endpoints require the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

Tokens are obtained from `POST /api/auth/login` and expire after **24 hours**.

---

## Auth Endpoints (Public)

### POST `/auth/register`

Create a new user account.

**Body:**
```json
{
  "username": "string (min 3 chars, required)",
  "password": "string (min 3 chars, required)",
  "email": "string (optional)"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": { "id": 1, "username": "john", "email": null, "is_admin": 0 },
  "token": "eyJhbGc..."
}
```

---

### POST `/auth/login`

Authenticate and receive JWT token.

**Body:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": { "id": 1, "username": "admin", "is_admin": 1 },
  "token": "eyJhbGc..."
}
```

---

## Auth Endpoints (Protected)

### GET `/auth/profile`

Returns current user profile.

### PUT `/auth/profile`

Update email or password.

**Body:**
```json
{
  "email": "new@email.com",
  "currentPassword": "old",
  "newPassword": "new"
}
```

### GET `/auth/check`

Quick token validation check.

### POST `/auth/logout`

Server-side logout confirmation (token removal is client-side).

---

## Scan Endpoints (Protected)

### POST `/scan/folder`

Scan directory structure only (no files).

**Body:**
```json
{
  "rootPath": "D:\\Media",
  "maxDepth": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Folder scan completed",
  "scannedCount": 1234,
  "rootPath": "D:\\Media"
}
```

---

### POST `/scan/file`

Scan files with full metadata.

**Body:**
```json
{
  "rootPath": "D:\\Media",
  "maxDepth": 10,
  "includeExtensions": [".mp4", ".mkv"],
  "excludeExtensions": [".tmp", ".log"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "File scan completed",
  "scannedFolders": 100,
  "scannedFiles": 5000,
  "rootPath": "D:\\Media"
}
```

---

### GET `/scan/status`

**Response:**
```json
{
  "folders": 1234,
  "files": 5678,
  "lastScan": "2026-06-13T10:00:00",
  "recentScans": [
    {
      "root_path": "D:\\Media",
      "status": "completed",
      "folders_count": 100,
      "files_count": 5000,
      "scan_options": "{\"maxDepth\":10}",
      "created_at": "2026-06-13T10:00:00"
    }
  ]
}
```

---

## Search Endpoints (Protected)

### GET `/search`

Advanced search with multiple filters.

**Query Parameters:**

| Param | Default | Values |
|-------|---------|--------|
| `query` | `""` | Search term |
| `mode` | `contains` | `exact`, `contains`, `fuzzy`, `word-based` |
| `caseSensitive` | `false` | `true` / `false` |
| `searchType` | `both` | `folders`, `files`, `both` |
| `searchIn` | `both` | `name`, `path`, `both` |
| `extension` | — | e.g. `.mp4` |
| `sizeMin` / `sizeMax` | — | Bytes |
| `dateFrom` / `dateTo` | — | ISO date string |
| `ancestorLevels` | `0` | 0-20 (folder tree depth) |
| `ancestorMode` | `from-root` | `from-root`, `from-match` |
| `page` | `1` | Page number |
| `limit` | `100` | Results per page |
| `limitEnabled` | `true` | `true` / `false` |
| `rootPaths` | — | Pipe-separated paths |

**Response:**
```json
{
  "folders": [{ "id": 1, "path": "...", "name": "...", ... }],
  "files": [{ "id": 1, "name": "...", "extension": "...", ... }],
  "totalFolders": 50,
  "totalFiles": 200,
  "pagination": { "page": 1, "limit": 100, "totalPages": 3 },
  "expandPaths": ["..."],
  "anchorPaths": ["..."],
  "highlightPaths": ["..."]
}
```

---

### GET `/search/extensions`

**Response:**
```json
[
  { "extension": ".mp4", "count": 500 },
  { "extension": ".jpg", "count": 300 }
]
```

### GET `/search/folders/root`

Returns top-level folders with `hasChildren` flag for lazy tree rendering.

### GET `/search/children/:encodedPath`

Returns child folders for a given parent path.

---

## Stats Endpoints (Protected)

### GET `/stats`

Full statistics dashboard data.

**Response:**
```json
{
  "summary": {
    "totalFolders": 1000,
    "totalFiles": 50000,
    "totalSize": 1073741824,
    "averageFileSize": 21474,
    "lastFolderScan": "...",
    "lastFileScan": "..."
  },
  "fileTypes": [{ "extension": ".mp4", "count": 500, "total_size": 1000000 }],
  "folderDepths": [{ "level": 0, "count": 5 }],
  "sizeDistribution": [{ "size_range": "1MB - 100MB", "count": 200 }],
  "largestFiles": [{ "name": "movie.mkv", "size": 4294967296 }],
  "busiestFolders": [{ "path": "D:\\Media\\Videos", "file_count": 500 }],
  "recentActivity": [{ "date": "2026-06-13", "files_modified": 10 }]
}
```

### GET `/stats/root-paths`

Latest scan info grouped by root path.

### GET `/stats/root-paths/:encodedRootPath`

Detailed scan history for a specific root path.

### GET `/stats/path?path=<folder_path>`

Statistics for a specific folder.

### GET `/stats/export?type=files&format=csv`

Download CSV file. `type` = `files` or `folders`.

---

## Delete Endpoints (Protected)

### DELETE `/delete`

**Body:**
```json
{
  "rootPath": "D:\\Media",
  "deleteType": "both"
}
```

`deleteType`: `folders`, `files`, `both`

### DELETE `/delete/file/:id`

Delete single file by ID.

### DELETE `/delete/all`

Delete ALL current user's data (folders, files, scans).

### POST `/delete/preview`

Preview what would be deleted without executing.

---

## Add Endpoints (Protected)

### POST `/add/file`

**Body:**
```json
{
  "name": "video.mp4",
  "path": "D:\\Media\\Videos",
  "extension": ".mp4",
  "size": 1048576
}
```

### POST `/add/folder`

**Body:**
```json
{
  "path": "D:\\Media\\New Folder",
  "name": "New Folder"
}
```

---

## Admin Endpoints (Admin-only)

### GET `/admin/users`

List all users with aggregated stats (scan count, folder count, file count).

### PUT `/admin/users/:id/password`

**Body:**
```json
{ "newPassword": "newpass123" }
```

### DELETE `/admin/users/:id`

Delete user and ALL their data (transaction-safe with rollback).

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Short error name",
  "message": "Human-readable explanation"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / missing params |
| 401 | Invalid credentials / token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate username) |
| 500 | Server error |
