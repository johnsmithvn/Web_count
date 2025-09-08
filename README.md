# Media Database Manager 🔐

🗂️ **Multi-user ứng dụng web quản lý và tìm kiếm cơ sở dữ liệu media và thư mục với authentication system**

## 🎯 Tổng quan

Ứng dụng thay thế quy trình Excel/VBA bằng giao diện web hiện đại với hệ thống đăng nhập đa người dùng. Mỗi user có data riêng biệt, chạy hoàn toàn local không phụ thuộc cloud.

## 🔐 Authentication System

### **Multi-user Support**
- ✅ **JWT-based authentication** with 24-hour expiry
- ✅ **User registration & login** with bcrypt password hashing  
- ✅ **Complete data isolation** - users only see their own scanned data
- ✅ **Admin role support** with elevated permissions
- ✅ **Auto token verification** and session management

### **Default Account**
- Username: `admin`
- Password: `admin`
- Role: Administrator

## 🏗️ Kiến trúc

- **Backend**: Node.js + Express + JWT Authentication
- **Frontend**: React 18 + Ant Design + AuthContext
- **Database**: SQLite + WAL mode + Multi-user schema
- **Security**: bcrypt password hashing + JWT tokens
- **API**: RESTful JSON với Bearer token authentication

## ✨ Tính năng chính

### 🔍 Hai chế độ quét (per user)
1. **Folder-only**: Chỉ quét cấu trúc thư mục
2. **File-detail**: Quét files với metadata đầy đủ

### 📊 Giao diện 5 tabs
1. **Dashboard**: Thống kê cá nhân với biểu đồ
2. **Folder Mode**: TreeView hiển thị cấu trúc thư mục của user
3. **File Mode**: Bảng dữ liệu files cá nhân
4. **Delete Files**: Xóa files theo tên với preview
5. **Add Files**: Thêm files thủ công

### 🔎 Khả năng tìm kiếm nâng cao
- **Multiple search modes**: 
  - `Exact Match`: Tìm kiếm chính xác
  - `Contains (chứa text)`: Tìm kiếm có chứa text (LIKE %text%)
  - `Fuzzy (similarity)`: True fuzzy search với character-gap matching
  - `Word-based (Windows-like)`: Tách thành các từ riêng biệt
  - `Regex`: Regular expression search
- **Advanced filters**: extension, size range, date range
- **Search scope**: Name only, Path only, hoặc Both
- **Case sensitivity** toggle
- **Server-side pagination** for large datasets

### 🛠️ User Features
- 👤 **User dropdown menu** với logout
- 📋 **Copy-to-clipboard** với cross-browser fallback
- 🔄 **Manual scan triggers** per user
- 📤 **Personal data export** (CSV/Excel)
- 🗑️ **Selective delete operations** với confirmation

## 🚀 Cài đặt & Chạy

### **Development Mode**

```bash
# Clone repository
git clone <repo-url>
cd Web_count

# Cài đặt tất cả dependencies
npm run install:all

# Khởi tạo database với authentication
npm run db:init

# Chạy development servers
npm run dev

# Chạy development server
npm run dev
```

```

**Servers sẽ tự động khởi động:**
- Frontend: http://localhost:5001
- Backend API: http://localhost:5000

### **Production Deployment**

```bash
# Setup production environment
npm run setup:prod

# Edit .env.production với settings thật
# Đặc biệt: JWT_SECRET, domain, security settings

# Build và deploy
chmod +x deploy.sh
./deploy.sh

# Hoặc thủ công:
npm run build
NODE_ENV=production npm run start:prod
```

## 💻 Sử dụng

### **Đăng nhập lần đầu**
1. Truy cập http://localhost:5001  
2. Login với admin/admin
3. Đổi password admin (recommended)
4. Tạo user accounts khác nếu cần

### **Workflow thông thường**
1. **Dashboard**: Xem thống kê data hiện tại
2. **Scan**: Trigger quét thư mục cần quản lý
3. **Search**: Tìm kiếm files/folders
4. **Browse**: Duyệt qua Folder Mode hoặc File Mode
5. **Export**: Xuất data khi cần

## 🔒 Security & Environment

### **Development (default)**
- Password requirement: 3+ characters
- JWT secret: default với warning
- Rate limiting: disabled
- HTTPS: optional

### **Production (NODE_ENV=production)**
- Password requirement: 8+ characters với complexity
- JWT secret: required environment variable
- Rate limiting: 5 attempts/15min
- HTTPS: required
- Security headers: enabled

### **Environment Variables**
Copy `.env.example` to `.env.production` and configure:

```bash
# Required for production
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-here

# Optional customization
PORT=5000
MAX_LOGIN_ATTEMPTS=5
ENABLE_RATE_LIMITING=true
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/profile` - Thông tin user
- `POST /api/auth/logout` - Đăng xuất

### Scan Operations (Protected)
- `POST /api/scan/folder` - Quét thư mục của user
- `POST /api/scan/file` - Quét files với metadata
- `GET /api/scan/status` - Trạng thái quét của user

### Search Operations (Protected)
- `GET /api/search` - Tìm kiếm data của user
- `GET /api/search/extensions` - Extensions của user
- `GET /api/search/children/:path` - Lazy loading folders

### Delete Operations (Protected)
- `DELETE /api/delete/` - Xóa data của user theo root path
- `POST /api/delete/preview` - Preview data sẽ bị xóa

### Statistics Operations (Protected)
- `GET /api/stats` - Thống kê cá nhân
- `GET /api/stats/export` - Export CSV của user

### Health Check
- `GET /api/health` - Kiểm tra server

## 🗄️ Database Schema

### Multi-user Architecture
```sql
-- Users table (authentication)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, 
  email TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scans table (track user operations)
CREATE TABLE scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  root_path TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  folders_count INTEGER DEFAULT 0,
  files_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Folders table (per user)
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
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Files table (linked via folders)
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER,
  extension TEXT,
  mime_type TEXT,
  folder_path TEXT,
  created_at DATETIME,
  modified_at DATETIME,
  accessed_at DATETIME,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Indexes for Performance

```sql
-- User isolation indexes
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_scans_user_id ON scans(user_id);

-- Search indexes
CREATE INDEX idx_folders_path ON folders(path);
CREATE INDEX idx_folders_parent_path ON folders(parent_path);
CREATE INDEX idx_files_folder_path ON files(folder_path);
CREATE INDEX idx_files_extension ON files(extension);

-- FTS5 virtual tables for search
CREATE VIRTUAL TABLE folders_fts USING fts5(name, path, content='folders', content_rowid='id');
CREATE VIRTUAL TABLE files_fts USING fts5(name, path, content='files', content_rowid='id');
```

## 🔧 Development

### Project Structure

```bash
Web_count/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── Dashboard.js  # Statistics overview
│   │   │   ├── FolderMode.js # TreeView cho folders
│   │   │   ├── FileMode.js   # DataTable cho files
│   │   │   └── SearchPanel.js # Search controls
│   │   └── services/
│   │       └── api.js        # API client
│   └── package.json
├── server/                   # Node.js backend
│   ├── routes/              # API routes
│   │   ├── auth.js          # Authentication
│   │   ├── scan.js          # Scanning operations
│   │   ├── search.js        # Search functionality
│   │   ├── stats.js         # Statistics & export
│   │   └── delete.js        # Delete operations
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js          # JWT authentication
│   │   └── security.js      # Rate limiting
│   ├── scripts/
│   │   └── initDb.js        # Database initialization
│   └── package.json
├── .env.development         # Development settings
├── .env.example            # Environment template
└── README.md               # This file
```

### Adding New Features

1. **Database Changes**: Update `server/scripts/initDb.js`
2. **API Endpoints**: Add to appropriate route file
3. **Frontend Components**: Create in `client/src/components/`
4. **Authentication**: Protected routes use JWT middleware
5. **Testing**: User sẽ là người test, không tự tạo test files

## 🚀 Deployment Checklist

### Pre-deployment

- [ ] Set `NODE_ENV=production`
- [ ] Configure strong `JWT_SECRET`
- [ ] Update database with production data
- [ ] Test authentication flow
- [ ] Verify search functionality
- [ ] Test scan operations

### Production Environment

- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Complex password requirements
- [ ] Log monitoring setup
- [ ] Database backup strategy

## 📝 CHANGELOG

Chi tiết tất cả thay đổi xem trong [CHANGELOG.md](./CHANGELOG.md).

### Recent Major Updates

- ✨ **Multi-user Authentication System**: JWT-based với bcrypt
- 🔍 **Enhanced Search Modes**: Exact, contains, fuzzy-real, word-based, regex
- 🔒 **Production Security**: Rate limiting, password policies, JWT secrets
- 🌍 **Environment Management**: Development vs production configurations
- 📚 **True Fuzzy Search**: Fuse.js implementation với character-gap matching

## 🤝 Contributing

1. Follow code changes protocol in `.github/copilot-instructions.md`
2. **ALWAYS** update `CHANGELOG.md` cho mọi thay đổi
3. No duplicate files (-simple, -sqlite3, etc.)
4. Server luôn chạy nền, không cần restart
5. User sẽ test, không tự tạo test files

## 📄 License

MIT License - Local use only, no cloud dependencies.

---

**⚠️ Security Note**: Đây là ứng dụng local-only. Trong production, cần thêm các biện pháp security như HTTPS, environment variables, và proper secret management.

## 📁 Cấu trúc dự án

```bash
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
- **Automation**: Trigger scan tự động thay vì manual refresh
- **Collaboration**: Multi-user access thay vì file sharing  
- **Backup**: Database backup đơn giản hơn .xlsm files

## 🔧 Development Notes

Ứng dụng được thiết kế local-only với multi-user authentication system.

### Scripts chính

```bash
# Development (khuyên dùng)
npm run dev          # Chạy concurrent client + server

# Production
npm run build        # Build React app cho production
npm run start:prod   # Start production server với built files

# Utilities
npm run setup:prod   # Setup production environment files
npm run db:reset     # Reset database (development only)
```

## � Features Roadmap

### Phase 1 (Current)

- ✅ Multi-user authentication system
- ✅ Enhanced search với multiple modes  
- ✅ Production security framework
- ✅ Environment configuration

### Phase 2

- Indexing nội dung file documents
- Advanced filtering và sorting
- Batch operations cho delete/move
- Data visualization charts

### Phase 3

- Hệ thống plugin cho custom file processors
- Real-time sync với file system changes
- Export formats mở rộng (JSON, XML)
- Performance analytics dashboard

---

## 🏃‍♂️ Quick Start Guide

1. **Clone và setup**:
   ```bash
   git clone <repo-url>
   cd Web_count
   npm install
   ```

2. **Khởi động development**:
   ```bash
   npm run dev
   ```

3. **Đầu tiên**:
   - Login với admin/admin
   - Scan 1 thư mục để test
   - Thử search với các modes khác nhau
   - Check Dashboard statistics

4. **Production setup**:
   ```bash
   npm run setup:prod
   # Edit .env.production
   npm run build
   NODE_ENV=production npm start:prod
   ```

## 📝 Changelog

Xem [CHANGELOG.md](./CHANGELOG.md) để biết lịch sử thay đổi chi tiết.

## 📄 Tài liệu kỹ thuật

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) - Tài liệu thiết kế hệ thống chi tiết
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) - Hướng dẫn development

---

🏠 **Local-Only** | 🔒 **Multi-User** | 🚀 **Fast** | 💾 **Portable** | 🔍 **Smart Search**

Enjoy your modern media database management! 🎉
