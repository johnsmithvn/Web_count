# Changelog

Tất cả thay đổi quan trọng của Media Database Manager sẽ được ghi lại ở đây.

Định dạng dựa theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ✨ [2025-09-04] Folder Mode highlights all matched folders (multi-hit highlight)
- �️ [2025-09-04] Ancestor Mode toggle (Folder Mode): choose between Option 1 (From match: last N parents) and Option 2 (From root: top N levels)
- �🌳 [2025-09-04] Added ancestor levels display for Folder Mode search — setting "Ancestor Levels" to auto-show N parent folders and auto-expand tree to the matched node
- ✨ [2025-09-04] Added matched-folder highlight in Folder Mode for quick visual focus
- ✨ [2025-09-04] Added search API helper fields for Folder Mode: `expandPaths`, `anchorPath`, `showAllFromPath`, `highlightPath`
- ⚡ [2025-09-03] Added Virtual Folder Tree - lazy loading với performance tối ưu cho hàng triệu folders, chỉ render visible nodes
- 🔍 [2025-09-03] Added "Search In" dropdown - cho phép search theo Name Only, Path Only, hoặc Name & Path
- 🎛️ [2025-09-03] Added Settings modal for search options - tách search settings ra popup modal riêng
- 📱 [2025-09-03] Added Folder Details modal - click folder trong tree để xem details trong popup thay vì sidebar
- 📋 [2025-09-03] Added click-to-copy functionality - click vào Name hoặc Folder Path column để copy text
- 🔔 [2025-09-03] Added toast notifications - hiển thị message khi copy thành công hoặc thất bại
- 🌳 [2025-09-03] Added Expand All / Collapse All buttons - control folder tree expansion state
- ⏳ [2025-09-03] Added loading states - loading indicators cho search, scan, delete, export operations
- 🎯 [2025-09-03] Added comprehensive toast notifications - success/error messages cho tất cả operations
- ❌ [2025-09-03] Added Delete Files tab - delete files by name với 2 modes: Contains và Exact Match
- 🔍 [2025-09-03] Added Word-based Search mode - Windows-like search tách thành các từ riêng biệt
- 📁 [2025-09-03] Added Add Files tab - thêm file thủ công với bắt buộc name và path
- 🚫 [2025-09-03] Added Exclude Extensions trong Scan Configuration - cho phép loại trừ file types không mong muốn
- 📁 [2025-09-03] Expanded file extensions list - thêm 60+ định dạng phổ biến cho video (.m4v, .webm, .ts), audio (.flac, .aac, .opus), ảnh (.webp, .tiff, .raw), documents, archives
- 🏷️ [2025-09-03] Organized extensions with OptGroup categories - phân loại thành Video 🎬, Audio 🎵, Images 🖼️, Documents 📄, Archives 📦, Code 💻 để dễ tìm kiếm

### Fixed
- 🐛 [2025-09-04] Fixed stale results after Clear → New Search in Folder Mode by resetting tree state on new results and clearing results before searching
- 🐛 [2025-09-04] Fixed search SQL builder producing `near "OR": syntax error` — guard empty sides when combining `(name OR path)` and align parameters for word-based mode (folders + files)
- 🐛 [2025-09-03] Fixed file search path column reference → Changed from `f.path` to `folders.path` trong search queries
- ⚠️ [2025-09-03] Fixed React warnings → Downgraded React 19 to React 18 for Ant Design compatibility  
- 🐛 [2025-09-03] Fixed useForm warnings → Added destroyOnHidden=true cho all modals để cleanup form instances
- 📊 [2025-09-03] Fixed Table pagination warnings → Used actual files.length thay vì totalFiles cho pagination.total
- 🔧 [2025-09-03] Fixed Modal deprecation → Changed destroyOnClose to destroyOnHidden for Ant Design v5
- 🐛 [2025-09-03] Fixed CSV export font encoding issues → Added UTF-8 BOM cho proper Excel display của tiếng Việt
- ⚠️ [2025-09-03] Fixed React warnings → Removed invalid CSS styles, fixed pagination total calculation, added toast cleanup
- ⚠️ [2025-09-03] Fixed Form instance warning → Used getFieldsValue() instead of validateFields() để tránh warning khi form chưa mount

### Changed
- 🔄 [2025-09-04] Folder Mode ancestors: when multiple matches exist, show all parent branches at the selected level (multiple anchors), not just a single parent
- 🔄 [2025-09-04] Changed Ancestor Levels semantics in Folder Mode → count from ROOT and display only the selected branch at that level (siblings above anchor are hidden); the matched node is highlighted and the branch below remains visible
- 🎨 [2025-09-03] Changed SearchPanel layout → Simplified to search bar + buttons, moved advanced options to Settings modal
- 🎨 [2025-09-03] Changed FolderMode layout → Full width folder structure, folder details in popup modal instead of sidebar
- 📊 [2025-09-03] Changed FileMode column layout → Increased Folder Path width, decreased other columns, reordered for better UX
- 📏 [2025-09-03] Changed Folder Path display → Increased maxWidth from 350px to 600px và width từ 40% to 45% để hiển thị path dài hơn
- 🚀 [2025-09-03] Changed client port → From 3001 to 5001 để tránh conflicts với other services

### Changed
- 🔄 [2025-09-03] Changed DELETE operation từ preview-based sang direct delete với confirmation only
- 🧹 [2025-09-03] Cleaned up debug code và removed debug files cho production readiness

### Added
- 📋 [2025-09-03] Added comprehensive CHANGELOG.md với full project history
- 📖 [2025-09-03] Added unified README.md cho toàn dự án với emoji và Vietnamese
- 📋 [2025-09-03] Added mandatory changelog update protocol trong copilot-instructions.md
- 🗑️ [2025-09-03] Added DELETE router với root path filtering - cho phép xóa selective data theo đường dẫn root
- 🛡️ [2025-09-03] Added DELETE preview functionality với confirmation modal - preview trước khi xóa thực tế
- 🎛️ [2025-09-03] Added DELETE controls trong SearchPanel - button và modal cho delete operations

### Removed  
- 🗑️ [2025-09-03] Removed client/README.md (Create React App template)
- 🗑️ [2025-09-03] Removed duplicate route files (scan-sqlite3.js, search-simple.js, stats-simple.js)

### Changed
- 🔄 [2025-09-03] Updated .gitignore to centralized management (removed client/.gitignore)
- 📖 [2025-09-03] Updated copilot-instructions.md với development guidelines và changelog requirements

## [1.0.0] - 2025-09-03

### Added

#### Tính năng chính
- 🚀 Ứng dụng web local-only hoàn chỉnh để quản lý media database
- 🔍 Hai chế độ quét: Folder-only và File-detail với metadata đầy đủ
- 📊 Dashboard với thống kê và biểu đồ (Recharts)
- 🌳 TreeView cho folder hierarchy (Ant Design Tree)
- 📋 DataTable cho file listings với sort/filter/pagination
- 🔎 Tìm kiếm nâng cao với nhiều chế độ (exact, fuzzy, regex)
- 📤 Export dữ liệu sang CSV

#### Backend (Node.js + Express)
- ✅ SQLite database với WAL mode và indexes tối ưu
- ✅ REST API endpoints cho scan, search, stats
- ✅ Database schema với tables folders và files
- ✅ Foreign key constraints và data integrity
- ✅ Error handling và logging toàn diện
- ✅ Health check endpoint

#### Frontend (React 18 + Ant Design)
- ✅ Modern UI với Ant Design components
- ✅ Tab navigation: Dashboard, Folder Mode, File Mode
- ✅ Search panel với advanced filters
- ✅ Responsive design cho desktop
- ✅ Copy-to-clipboard utilities
- ✅ API service layer cho communication

#### Database
- ✅ SQLite database với optimized indexes
- ✅ Foreign key relationships (folders ↔ files)
- ✅ Automatic timestamps (created_at, modified_at, scanned_at)
- ✅ Performance indexes cho search operations

### Technical Details

#### API Endpoints
- `POST /api/scan/folder` - Folder-only scanning
- `POST /api/scan/file` - File detail scanning with metadata
- `GET /api/scan/status` - Scan status and counts
- `GET /api/search` - Advanced search với multiple filters
- `GET /api/search/extensions` - File extension statistics
- `GET /api/stats` - Database statistics và analytics
- `GET /api/stats/export` - CSV export functionality
- `GET /api/health` - Server health check

#### Frontend Components
- `Dashboard.js` - Statistics overview với Recharts
- `FolderMode.js` - TreeView với folder selection
- `FileMode.js` - DataTable với advanced features
- `SearchPanel.js` - Search controls và scan triggers
- `api.js` - Centralized API service layer

#### Development Setup
- ✅ Concurrent development servers (server:5000, client:3001)
- ✅ Nodemon cho auto-restart server
- ✅ React dev server với hot reload
- ✅ ESLint configuration cho code quality

### Fixed

#### Runtime Errors
- 🐛 Fixed `InputNumber.Group` deprecation → `Space.Compact`
- 🐛 Fixed `Tabs.TabPane` deprecation → `items` prop
- 🐛 Fixed SQL ambiguous column names trong file search queries
- 🐛 Fixed React hooks dependency warnings
- 🐛 Removed unused imports causing linting warnings

#### Database Issues
- 🐛 Fixed better-sqlite3 compilation issues → switched to sqlite3
- 🐛 Fixed database initialization timing issues
- 🐛 Fixed async/callback patterns cho sqlite3

#### Development Issues
- 🐛 Fixed port conflicts (React dev server port 3001)
- 🐛 Fixed concurrent development script configuration
- 🐛 Fixed build directory handling cho production

### Project Structure
- 📁 Organized route files (removed duplicate/backup files)
- 📁 Centralized .gitignore management
- 📁 Comprehensive documentation (README.md, SYSTEM_DESIGN.md)
- 📁 Clean project structure với proper separation of concerns

### Dependencies

#### Backend
- express: ^4.18.2 - Web framework
- sqlite3: ^5.1.6 - Database driver
- cors: ^2.8.5 - CORS middleware
- fs-extra: ^11.1.1 - Enhanced file system operations

#### Frontend
- react: ^18.2.0 - UI framework
- antd: ^5.8.6 - UI component library
- recharts: ^2.8.0 - Charts và visualization

#### Development
- concurrently: ^8.2.0 - Run multiple npm scripts
- nodemon: ^3.0.1 - Auto-restart server

### Performance
- ⚡ SQLite WAL mode cho concurrent operations
- ⚡ Database indexes cho fast search
- ⚡ Pagination cho large datasets
- ⚡ Debounced search input
- ⚡ Optimized React component renders

### Security
- 🔒 Local-only operation (no network calls)
- 🔒 No external dependencies cho data
- 🔒 User-controlled file system access
- 🔒 Graceful error handling cho permission issues

---

## Migration Notes

### From Excel/VBA
- Thay thế Excel spreadsheet bằng SQLite database
- Modern web UI thay cho VBA forms
- Real-time search thay cho Excel filters
- Better performance với large datasets
- Portable database files

### Database Schema
```sql
-- Folders table
CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_path TEXT,
  level INTEGER DEFAULT 0,
  created_at DATETIME,
  modified_at DATETIME,
  accessed_at DATETIME,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Files table  
CREATE TABLE files (
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
);
```

---

## Commit History Summary

1. **Initial Project Setup**
   - Created full-stack architecture
   - Set up Node.js backend với Express
   - Set up React frontend với Ant Design

2. **Database Implementation**
   - SQLite database với optimized schema
   - Database initialization scripts
   - Performance indexes

3. **API Development**
   - Scan endpoints (folder/file modes)
   - Search endpoints với advanced filtering
   - Statistics endpoints với export

4. **Frontend Implementation**
   - Dashboard với charts và statistics
   - Folder TreeView với selection
   - File DataTable với advanced features
   - Search panel với multiple filters

5. **Bug Fixes và Optimization**
   - Fixed React component deprecation warnings
   - Fixed SQL query ambiguity issues
   - Fixed development server configuration
   - Cleaned up unused files

6. **Documentation**
   - Comprehensive README.md
   - Detailed SYSTEM_DESIGN.md
   - This CHANGELOG.md
   - Updated copilot-instructions.md

---

**Full Commit**: Initial release of Media Database Manager v1.0.0 - Local-only web application for media file and folder management with modern React UI and SQLite backend.
