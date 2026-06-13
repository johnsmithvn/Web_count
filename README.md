# Media Database Manager

🗂️ **Ứng dụng web quản lý và tìm kiếm cơ sở dữ liệu media và thư mục chạy hoàn toàn local**

## 🎯 Tổng quan

Ứng dụng này thay thế quy trình Excel/VBA bằng giao diện web hiện đại để quét và quản lý thông tin file/thư mục. Chạy hoàn toàn local không phụ thuộc cloud.

## 🏗️ Kiến trúc

- **Backend**: Node.js + Express
- **Frontend**: React 18 + Ant Design
- **Database**: SQLite + WAL mode + Indexes tối ưu
- **API**: RESTful JSON
- **Development**: Concurrent dev servers

## ✨ Tính năng chính

### 🔍 Hai chế độ quét
1. **Folder-only**: Chỉ quét cấu trúc thư mục (bỏ qua files)
2. **File-detail**: Quét files với metadata đầy đủ (music, video, documents...)

### 📊 Giao diện 3 tabs
1. **Dashboard**: Thống kê với biểu đồ
2. **Folder Mode**: TreeView hiển thị cấu trúc thư mục
  - Ancestor Levels (Folder Mode): đếm từ gốc (root) xuống. Khi > 0, UI chỉ hiển thị 1 nhánh tại cấp đã chọn (ẩn các folder cùng cấp khác ở trên), tự động mở từ gốc → tới kết quả và làm nổi bật folder trúng.
3. **File Mode**: Bảng dữ liệu files có thể sắp xếp

### 🔎 Khả năng tìm kiếm
- Thanh tìm kiếm global
- Nhiều chế độ: exact match, fuzzy search, regex
- Toggle case-sensitive/insensitive
- Lọc theo extension, khoảng ngày, kích thước
 - Folder Mode helpers (server response): `expandPaths` (chuỗi từ root → match), `anchorPath` (node tại cấp được chọn), `showAllFromPath` (đứa con của anchor dẫn xuống kết quả), `highlightPath` (path cần highlight)

### 🛠️ Tiện ích
- Copy đường dẫn file/thư mục
- Trigger quét thủ công
- Export CSV/Excel
- Phân trang cho dataset lớn
- **🗑️ Delete Operations**: Xóa selective data theo root path với preview

## 🚀 Cài đặt

```bash
# Cài đặt dependencies
npm install

# Khởi tạo database
npm run db:init

# Chạy development server
npm run dev
```

## 💻 Sử dụng

1. Khởi động ứng dụng: `npm run dev`
2. Mở browser tại `http://localhost:3001` (React) hoặc `http://localhost:5000` (API)
3. Sử dụng nút scan để populate database
4. Tìm kiếm và duyệt collection media của bạn

## 📡 API Endpoints

### Scan Operations
- `POST /api/scan/folder` - Quét chỉ thư mục
- `POST /api/scan/file` - Quét file với metadata
- `GET /api/scan/status` - Trạng thái quét

### Search Operations  
- `GET /api/search` - Tìm kiếm nâng cao
- `GET /api/search/extensions` - Danh sách extensions

### Delete Operations
- `DELETE /api/delete/` - Xóa data theo root path và type
- `DELETE /api/delete/all` - Xóa toàn bộ database
- `POST /api/delete/preview` - Preview data sẽ bị xóa

### Statistics Operations
- `GET /api/stats` - Thống kê database
- `GET /api/stats/path` - Thống kê thư mục cụ thể
- `GET /api/stats/export` - Export CSV

### Health Check
- `GET /api/health` - Kiểm tra server

## 🗄️ Database Schema

### Bảng Users (Authentication)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

### Bảng Scans (Lịch sử quét)
```sql
CREATE TABLE scans (
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
);
```

### Bảng Folders
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
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Bảng Files
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
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
```

## 📁 Cấu trúc dự án

```
media-database-manager/
├── 📄 package.json              # Root package configuration
├── 📄 README.md                 # Tài liệu dự án (file này)
├── 📄 CHANGELOG.md              # Lịch sử thay đổi
├── 📄 SYSTEM_DESIGN.md          # Tài liệu thiết kế hệ thống
├── 📄 .gitignore                # Git ignore rules (tập trung)
├── 📂 server/                   # Backend Node.js application
│   ├── 📄 package.json         # Server dependencies
│   ├── 📄 index.js             # Express server setup
│   ├── 🗄️ database.db          # SQLite database file
│   ├── 📂 routes/              # API route handlers
│   │   ├── 📄 scan.js          # Folder/file scanning endpoints
│   │   ├── 📄 search.js        # Search and filtering endpoints
│   │   ├── 📄 stats.js         # Statistics and export endpoints
│   │   └── 📄 delete.js        # Delete operations with preview
│   └── 📂 scripts/
│       └── 📄 initDb.js        # Database initialization
├── 📂 client/                  # Frontend React application
│   ├── 📄 package.json         # Frontend dependencies
│   ├── 📂 public/              # Static assets
│   └── 📂 src/                 # React source code
│       ├── 📂 components/      # React components
│       │   ├── 📄 Dashboard.js    # Statistics overview
│       │   ├── 📄 FolderMode.js   # TreeView folders
│       │   ├── 📄 FileMode.js     # DataTable files
│       │   └── 📄 SearchPanel.js  # Search controls
│       ├── 📂 services/        # API communication
│       │   └── 📄 api.js       # API service layer
│       ├── 📄 App.js          # Main application
│       └── 📄 App.css         # Custom styling
└── 📂 .github/
    └── 📄 copilot-instructions.md  # Development guidelines
```

## 🆚 So sánh với Excel/VBA

### Ưu điểm
✅ **Giao diện hiện đại**: Web-based với responsive design  
✅ **Tìm kiếm real-time**: Lọc và search tức thời  
✅ **Lưu trữ dữ liệu**: SQLite database với cấu trúc quan hệ  
✅ **Khả năng mở rộng**: Xử lý dataset lớn với pagination  
✅ **Tương thích Export**: CSV export tương thích Excel  
✅ **Đa platform**: Hoạt động trên Windows, Mac, Linux  
✅ **Bảo trì**: Codebase được version control  

### Lợi ích di chuyển
- **Hiệu suất**: Nhanh hơn Excel với dataset lớn
- **Độ tin cậy**: Không bị crash hay giới hạn memory như Excel
- **Linh hoạt**: Dễ dàng thêm tính năng và filter mới
- **Chia sẻ**: Database file portable và nhẹ
- **Tự động hóa**: API cho phép tự động hóa trong tương lai

## 🔧 Development

Ứng dụng được thiết kế chỉ cho sử dụng local. Tất cả dữ liệu được lưu trên máy trong file SQLite database.

### Scripts chính
```bash
npm run dev          # Chạy cả server và client
npm run server:dev   # Chỉ chạy server (port 5000)
npm run client:dev   # Chỉ chạy client (port 3001)
npm run build        # Build production
npm run db:init      # Khởi tạo database
```

## 🚧 Tính năng tương lai

### Phase 2
- Indexing nội dung file documents
- Tạo thumbnail cho images
- Phát hiện file trùng lặp
- Scan tự động theo lịch

### Phase 3
- Hệ thống plugin cho custom file processors
- Tích hợp cloud storage APIs
- Hỗ trợ multi-user với access controls
- RESTful API cho external integrations

## 📝 Changelog

Xem [CHANGELOG.md](./CHANGELOG.md) để biết lịch sử thay đổi chi tiết.

## 📄 Tài liệu kỹ thuật

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) - Tài liệu thiết kế hệ thống chi tiết
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) - Hướng dẫn development

---

🏠 **Local-Only** | 🔒 **Secure** | 🚀 **Fast** | 💾 **Portable**
