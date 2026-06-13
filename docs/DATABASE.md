# Media Database Manager — Database Reference

> **Version:** 1.1.0 | **Last Updated:** 2026-06-13

## Tables Overview

| # | Table | Rows (typical) | Description |
|---|-------|----------------|-------------|
| 1 | `users` | 1-10 | User accounts |
| 2 | `scans` | 10-100 | Scan history per user |
| 3 | `folders` | 1K-100K | Folder metadata per user |
| 4 | `files` | 10K-1M+ | File metadata (owned via folder) |

## Ownership Model

```
files ──(folder_id)──→ folders ──(user_id)──→ users
```

- `files` has **NO** `user_id` column
- File ownership is **implicit** through `folder_id → folders.user_id`
- All file queries MUST `JOIN folders ON f.folder_id = folders.id` then filter `WHERE folders.user_id = ?`
- Use `JOIN` (not `LEFT JOIN`) — orphan files should not be returned

## Schema Source of Truth

**File:** `server/scripts/initDb.js`

All tables use `CREATE TABLE IF NOT EXISTS` — safe for re-running.

## Column Reference

### users

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| username | TEXT | UNIQUE NOT NULL | Min 3 chars (enforced by auth route) |
| password | TEXT | NOT NULL | bcrypt hash (10 rounds) |
| email | TEXT | | Optional |
| is_admin | INTEGER | DEFAULT 0 | 1 = admin |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| last_login | DATETIME | | Set on login |

### scans

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | INTEGER | NOT NULL, FK → users.id | CASCADE delete |
| root_path | TEXT | NOT NULL | e.g. `D:\Media` |
| status | TEXT | DEFAULT 'completed' | |
| folders_count | INTEGER | DEFAULT 0 | |
| files_count | INTEGER | DEFAULT 0 | |
| scan_options | TEXT | | JSON: `{ maxDepth, includeExtensions, excludeExtensions }` |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| completed_at | DATETIME | | |

> ⚠️ **Note:** There is NO `scan_type` column. Use `scan_options` to determine scan mode.

### folders

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | INTEGER | NOT NULL, FK → users.id | CASCADE delete |
| path | TEXT | NOT NULL | Full filesystem path |
| name | TEXT | NOT NULL | Folder basename |
| parent_path | TEXT | | NULL for root entries |
| level | INTEGER | DEFAULT 0 | Depth in hierarchy |
| created_at | DATETIME | | Filesystem ctime |
| modified_at | DATETIME | | Filesystem mtime |
| accessed_at | DATETIME | | Filesystem atime |
| scanned_at | DATETIME | | When record was created |

### files

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL | File name with extension |
| extension | TEXT | | Lowercase, e.g. `.mp4` |
| size | INTEGER | | Bytes |
| folder_id | INTEGER | FK → folders.id | CASCADE delete |
| created_at | DATETIME | | Filesystem ctime |
| modified_at | DATETIME | | Filesystem mtime |
| accessed_at | DATETIME | | Filesystem atime |
| scanned_at | DATETIME | | When record was created |

## Indexes (13 total)

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| idx_users_username | users | username | Login lookup |
| idx_scans_user_id | scans | user_id | User's scan history |
| idx_scans_status | scans | status | Status filtering |
| idx_folders_user_id | folders | user_id | User's folders |
| idx_folders_path | folders | path | Path lookup |
| idx_folders_parent_path | folders | parent_path | Tree navigation |
| idx_folders_level | folders | level | Depth queries |
| idx_folders_user_path | folders | user_id, path | Composite for scan |
| idx_files_folder_id | files | folder_id | Folder→files join |
| idx_files_extension | files | extension | Extension filtering |
| idx_files_size | files | size | Size range queries |
| idx_files_name | files | name | File name search |

## Query Patterns

### Get files for a user
```sql
SELECT f.* FROM files f
JOIN folders ON f.folder_id = folders.id
WHERE folders.user_id = ?
```

### Get file count per user
```sql
SELECT COUNT(*) as count FROM files f
JOIN folders ON f.folder_id = folders.id
WHERE folders.user_id = ?
```

### Get extensions with counts
```sql
SELECT f.extension, COUNT(*) as count
FROM files f
JOIN folders ON f.folder_id = folders.id
WHERE folders.user_id = ? AND f.extension IS NOT NULL AND f.extension != ''
GROUP BY f.extension
ORDER BY count DESC
```

### Delete all user data
```sql
-- Order matters: files first (FK constraint), then folders, then scans
DELETE FROM files WHERE folder_id IN (SELECT id FROM folders WHERE user_id = ?);
DELETE FROM folders WHERE user_id = ?;
DELETE FROM scans WHERE user_id = ?;
```

## Database File

- **Location:** `server/database.db`
- **Mode:** WAL (`PRAGMA journal_mode = WAL`)
- **Foreign Keys:** Enabled (`PRAGMA foreign_keys = ON`)
- **Init Script:** `npm run db:init` (`server/scripts/initDb.js`)
