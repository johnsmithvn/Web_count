# Media Database Manager - System Design Document

## Overview

This is a comprehensive system design for a **local-only multi-user web application** that manages and searches media and folder databases. The application replaces Excel/VBA workflows with a modern, web-based interface featuring JWT-based authentication and user data isolation.

## Architecture

### Technology Stack
- **Frontend**: React 18 with Ant Design UI library
- **Backend**: Node.js with Express framework  
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: SQLite with optimized indexes and FTS5 search
- **Communication**: RESTful API with JSON
- **Security**: Rate limiting, environment-based policies
- **Development**: Concurrent development server setup

### Key Design Principles
1. **Local-Only Operation**: No cloud dependencies, all data stays on user's machine
2. **Multi-User Authentication**: JWT-based user isolation with secure sessions
3. **Manual Control**: User-triggered scans, no automatic background processes
4. **Dual Mode Operation**: Separate folder-only and file-detail scanning modes
5. **Enhanced Search**: Multiple search modes including true fuzzy search with Fuse.js
6. **Export Capability**: Per-user CSV export for external analysis
7. **Production Ready**: Environment-based configuration and security hardening

## Database Schema

### Users Table (Authentication)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,              -- bcrypt hashed password
  email TEXT,                          -- Optional email field
  is_admin INTEGER DEFAULT 0,         -- Admin privilege flag
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Scans Table (User Operations Tracking)
```sql
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
```

### Folders Table (Per User)
```sql
CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,            -- User isolation
  path TEXT NOT NULL,                  -- Full folder path
  name TEXT NOT NULL,                  -- Folder name only
  parent_path TEXT,                    -- Parent folder path
  level INTEGER DEFAULT 0,            -- Depth level in hierarchy
  created_at DATETIME,                -- File system creation date
  modified_at DATETIME,               -- File system modification date
  accessed_at DATETIME,               -- File system access date
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When this record was created
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Files Table (Per User)
```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,            -- User isolation
  path TEXT NOT NULL,                  -- Full file path
  name TEXT NOT NULL,                  -- File name with extension
  size INTEGER,                        -- File size in bytes
  extension TEXT,                      -- File extension (.mp4, .jpg, etc.)
  mime_type TEXT,                      -- MIME type detection
  folder_path TEXT,                    -- Parent folder path
  created_at DATETIME,                -- File system creation date
  modified_at DATETIME,               -- File system modification date
  accessed_at DATETIME,               -- File system access date
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When this record was created
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Indexes for Performance
```sql
-- User isolation indexes
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_scans_user_id ON scans(user_id);

-- Search performance indexes
CREATE INDEX idx_folders_path ON folders(path);
CREATE INDEX idx_folders_parent_path ON folders(parent_path);
CREATE INDEX idx_files_folder_path ON files(folder_path);
CREATE INDEX idx_files_extension ON files(extension);
CREATE INDEX idx_folders_level ON folders(level);
CREATE INDEX idx_files_size ON files(size);

-- FTS5 virtual tables for advanced search
CREATE VIRTUAL TABLE folders_fts USING fts5(name, path, content='folders', content_rowid='id');
CREATE VIRTUAL TABLE files_fts USING fts5(name, path, content='files', content_rowid='id');
```
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
```

### Indexes for Performance
```sql
-- Folder indexes
CREATE INDEX idx_folders_path ON folders(path);
CREATE INDEX idx_folders_parent ON folders(parent_path);
CREATE INDEX idx_folders_level ON folders(level);

-- File indexes
CREATE INDEX idx_files_folder ON files(folder_id);
CREATE INDEX idx_files_extension ON files(extension);
CREATE INDEX idx_files_size ON files(size);
```

## API Endpoints

### Authentication Endpoints
- **POST** `/api/auth/register`
  - **Purpose**: Register new user account
  - **Body**: `{ username, password, email? }`
  - **Response**: `{ success, message, user }`

- **POST** `/api/auth/login`
  - **Purpose**: User authentication with JWT
  - **Body**: `{ username, password }`
  - **Response**: `{ success, token, user }`

- **GET** `/api/auth/profile` *(Protected)*
  - **Purpose**: Get current user profile
  - **Headers**: `Authorization: Bearer <token>`
  - **Response**: `{ user }`

- **POST** `/api/auth/logout` *(Protected)*
  - **Purpose**: Logout and invalidate token
  - **Response**: `{ success, message }`

### Scan Operations *(All Protected)*
- **POST** `/api/scan/folder`
  - **Purpose**: Scan directory structure for authenticated user
  - **Body**: `{ rootPath, maxDepth }`
  - **Response**: `{ success, message, scannedCount, rootPath }`

- **POST** `/api/scan/file`
  - **Purpose**: Scan files with metadata for authenticated user
  - **Body**: `{ rootPath, maxDepth, includeExtensions[] }`
  - **Response**: `{ success, message, scannedFolders, scannedFiles, rootPath }`

- **GET** `/api/scan/status`
  - **Purpose**: Get user's scan status and counts
  - **Response**: `{ folders, files, lastScan }`

### Search Operations *(All Protected)*
- **GET** `/api/search`
  - **Purpose**: Advanced search within user's data
  - **Query Parameters**:
    - `query`: Search term
    - `mode`: exact|contains|fuzzy-real|word-based|regex
    - `caseSensitive`: true|false
    - `searchType`: folders|files|both
    - `extension`: File extension filter
    - `sizeMin/sizeMax`: Size range in bytes
    - `dateFrom/dateTo`: Date range
    - `page/limit`: Pagination
  - **Response**: `{ folders[], files[], totalFolders, totalFiles, pagination }`

- **GET** `/api/search/extensions`
  - **Purpose**: Get user's file extensions with counts
  - **Response**: `[{ extension, count }]`

- **GET** `/api/search/children/:path`
  - **Purpose**: Lazy loading for folder tree expansion
  - **Response**: `{ folders[], files[] }`

### Delete Operations *(All Protected)*
- **DELETE** `/api/delete/`
  - **Purpose**: Delete user's data by root path and type
  - **Body**: `{ rootPath, deleteType }`
  - **Response**: `{ success, message, deletedFolders, deletedFiles }`

- **POST** `/api/delete/preview`
  - **Purpose**: Preview user's data that would be deleted
  - **Body**: `{ rootPath, deleteType }`
  - **Response**: `{ folders[], files[], totalFolders, totalFiles }`

### Statistics Operations *(All Protected)*
- **GET** `/api/stats`
  - **Purpose**: User's database statistics and analytics
  - **Response**: Complex object with summary, distributions, and insights

- **GET** `/api/stats/export?type=files|folders&format=csv`
  - **Purpose**: Export user's data to CSV
  - **Response**: CSV file download

### Health Check *(Public)*
- **GET** `/api/health`
  - **Purpose**: Server status check
  - **Response**: `{ status: "OK", message }`

## Authentication & Security Architecture

### JWT Implementation
- **Token Structure**: Header.Payload.Signature with user ID and expiration
- **Expiration**: 24 hours for security balance
- **Storage**: Client-side localStorage with automatic cleanup
- **Middleware**: Express middleware validates all protected routes

### Password Security
- **Hashing**: bcrypt with salt rounds for secure storage
- **Complexity Requirements**:
  - Development: 3+ characters (for testing convenience)
  - Production: 8+ characters with complexity requirements
- **No Password Reset**: Local-only application design choice

### Environment-Based Security
```javascript
// Development mode
{
  "passwordMinLength": 3,
  "jwtSecret": "dev-secret-with-warning",
  "rateLimiting": false
}

// Production mode  
{
  "passwordMinLength": 8,
  "complexityRequired": true,
  "jwtSecret": "REQUIRED-ENV-VARIABLE",
  "rateLimiting": true,
  "httpsRequired": true
}
```

### Rate Limiting (Production)
- **Login Attempts**: 5 attempts per 15 minutes per IP
- **API Requests**: General rate limiting for DoS protection
- **Middleware**: Express-rate-limit with memory store

## Frontend Architecture

### Component Structure
```bash
src/
├── components/
│   ├── Dashboard.js          # Statistics overview with charts
│   ├── FolderMode.js         # TreeView for folder hierarchy  
│   ├── FileMode.js           # DataTable for file listings
│   ├── SearchPanel.js        # Search controls and scan triggers
│   ├── AddFilesMode.js       # Manual file addition interface
│   ├── DeleteMode.js         # Bulk delete operations
│   └── VirtualFolderTree.js  # Performance-optimized tree component
├── services/
│   └── api.js                # JWT-aware API communication layer
├── App.js                    # Main application layout
└── App.css                   # Custom styling
```

### Enhanced Search Features

#### Multi-Mode Search Implementation
- **Exact Mode**: Precise string matching with case sensitivity options
- **Contains Mode**: Substring matching (renamed from "fuzzy" for clarity)  
- **Fuzzy-Real Mode**: True fuzzy search using Fuse.js with character-gap matching
- **Word-Based Mode**: Searches for whole word matches
- **Regex Mode**: Advanced pattern matching for power users

#### Search Performance
- **FTS5 Integration**: SQLite Full-Text Search for optimal performance
- **Debounced Input**: 300ms delay to prevent excessive API calls
- **Result Caching**: Client-side caching for repeated searches
- **Progressive Loading**: Pagination with lazy loading for large result sets

### Key Features

#### Dashboard Tab
- **User-Specific Summary**: Personal folders, files, size, last scan
- **File Type Distribution**: Pie chart of user's extensions
- **Size Distribution**: Bar chart of user's file size ranges
- **Recent Activity**: User's scanning and search history
- **Quick Actions**: Common operations for the authenticated user

#### Folder Mode Tab
- **User-Isolated TreeView**: Only user's folder hierarchy displayed
- **Interactive Selection**: Click to view folder details
- **Lazy Loading**: Load child nodes on expansion for performance
- **Context Actions**: User-specific operations (delete, rescan)
- **Copy Path Utility**: One-click path copying

#### File Mode Tab
- **User-Filtered Data Table**: Only user's files with advanced filtering
- **Column Management**: Customizable columns (size, date, type)
- **Smart Pagination**: Efficient handling of large user datasets
- **Multi-Sort**: Sort by multiple columns simultaneously
- **Bulk Actions**: Select multiple files for operations

#### Search Panel
- **Multi-Mode Search Bar**: Enhanced search with 5 different modes
- **Real-time Filters**: Instant filtering as user types
- **Advanced Options**:
  - Search modes: exact, contains, fuzzy-real, word-based, regex
  - Case sensitivity toggle
  - Extension filtering with user's available types
  - Size range filtering with intelligent defaults
  - Date range filtering for temporal analysis
- **Scan Controls**: User-specific manual folder/file scanning
- **Delete Controls**: Preview and delete user's data safely
- **Export Options**: User-specific CSV download

## User Workflows

### First-Time Setup & Authentication
1. User opens `http://localhost:5001` (React dev server)
2. **Registration**: Creates account with username/password
3. **Login**: Authenticates and receives JWT token
4. **Dashboard**: Views empty state with scan prompts
5. **First Scan**: Scans initial directory to populate data

### Authenticated Daily Usage
1. **Login**: Authenticate with stored or new credentials
2. **Browse**: Navigate user's personal data across tabs
3. **Search**: Use enhanced search modes to find specific items
4. **Analyze**: View personal statistics and distributions  
5. **Manage**: Scan new directories, delete old data
6. **Export**: Download personal data for external analysis

### Multi-User Scenarios
1. **Shared Machine**: Multiple users can have separate accounts
2. **Data Isolation**: Each user only sees their own scanned data
3. **Independent Operations**: Scans and searches don't interfere
4. **Admin Functions**: Admin users can manage system-wide settings

### Search Operations
1. **Quick Search**: Enter term in search bar, select mode
2. **Filter Results**: Apply extension, size, or date filters
3. **Review Results**: Browse folders/files in respective tabs
4. **Copy Paths**: Use copy buttons for file operations
5. **Clear Results**: Return to full dataset view

## Performance Considerations

### Database Optimization
- **SQLite WAL Mode**: Concurrent read/write for multi-user access
- **User Isolation Indexes**: Optimized queries for user-specific data
- **FTS5 Integration**: Full-text search for enhanced performance
- **Prepared Statements**: Prevent SQL injection and improve performance
- **Foreign Key Constraints**: Maintain data integrity across users

### Frontend Optimization
- **JWT Token Management**: Automatic token refresh and secure storage
- **Debounced Search**: 300ms delay prevents excessive API calls
- **Virtual Scrolling**: Efficient rendering for large folder trees
- **Pagination**: Handle large user datasets (50-200 items per page)
- **Component Memoization**: React.memo for expensive renders

### Authentication Optimization
- **bcrypt Async**: Non-blocking password hashing
- **Token Caching**: Client-side JWT storage with validation
- **Session Management**: Automatic logout on token expiration
- **Rate Limiting**: Prevent brute force attacks in production

### Scanning Optimization
- **User-Scoped Operations**: Only scan/index user's authorized paths
- **Configurable Depth**: Prevent infinite recursion in scan operations
- **Async File Operations**: Non-blocking filesystem access
- **Error Handling**: Graceful handling of permission-denied folders
- **Progress Tracking**: User-specific scan status and feedback

## Security Considerations

### Authentication Security
- **JWT Tokens**: Stateless authentication with 24-hour expiration
- **Password Hashing**: bcrypt with salt rounds for secure storage
- **Environment-Based Policies**: Stricter requirements in production
- **No Password Reset**: Local-only design eliminates email dependencies
- **Session Management**: Automatic cleanup on logout/expiration

### Data Isolation
- **User-Scoped Queries**: All database operations filter by user_id
- **API Route Protection**: JWT middleware on all data endpoints
- **Frontend Guards**: Component-level authentication checks
- **Database Constraints**: Foreign keys ensure data integrity

### Local-Only Design
- **No Cloud Communication**: All data remains on user's machine
- **Localhost-Only**: Server binds only to local interfaces
- **SQLite Security**: File-based database with local access control
- **No External Dependencies**: Authentication and data local-only

### File System Security
- **User-Controlled Paths**: Only scan user-provided directories
- **Read-Only Access**: No file modification, only metadata reading
- **Permission Handling**: Graceful error handling for access denied
- **Path Validation**: Prevent directory traversal attacks

## Environment Configuration

### Development Environment
```javascript
{
  "NODE_ENV": "development",
  "PORT": 5000,
  "JWT_SECRET": "dev-secret-with-warning",
  "PASSWORD_MIN_LENGTH": 3,
  "RATE_LIMITING_ENABLED": false
}
```

### Production Environment
```javascript
{
  "NODE_ENV": "production", 
  "PORT": 5000,
  "JWT_SECRET": "REQUIRED-STRONG-SECRET",
  "PASSWORD_MIN_LENGTH": 8,
  "PASSWORD_COMPLEXITY": true,
  "RATE_LIMITING_ENABLED": true,
  "MAX_LOGIN_ATTEMPTS": 5,
  "HTTPS_REQUIRED": true
}
```

## Deployment Instructions

### Prerequisites
- Node.js 16+ installed
- NPM package manager
- Modern web browser (Chrome, Firefox, Edge)

### Development Installation
```bash
# Clone project
cd Web_count

# Install dependencies
npm install

# Setup development environment
npm run setup:dev

# Initialize database with auth schema
npm run db:init

# Start development servers
npm run dev
```

### Production Deployment
```bash
# Setup production environment
npm run setup:prod

# Edit .env.production with secure values
# Especially: JWT_SECRET, security settings

# Build React frontend
npm run build

# Start production server
NODE_ENV=production npm run start:prod

# Access application at http://localhost:5000
```

## Updated File Structure
```bash
Web_count/
├── package.json                    # Root package with scripts
├── README.md                       # Updated user documentation
├── CHANGELOG.md                    # Required change tracking
├── SYSTEM_DESIGN.md               # This technical document
├── .env.development               # Development environment
├── .env.example                   # Environment template
├── deploy.sh                      # Production deployment script
├── server/                        # Backend Node.js application
│   ├── package.json               # Server dependencies
│   ├── index.js                   # Express server with auth
│   ├── database.db                # SQLite with multi-user schema
│   ├── routes/                    # Protected API endpoints
│   │   ├── auth.js                # Authentication endpoints
│   │   ├── scan.js                # User-scoped scanning
│   │   ├── search.js              # Enhanced search with fuzzy
│   │   ├── stats.js               # User statistics & export
│   │   ├── delete.js              # User-scoped delete operations
│   │   └── add.js                 # Manual file addition
│   ├── middleware/                # Custom middleware
│   │   ├── auth.js                # JWT authentication
│   │   └── security.js            # Rate limiting & headers
│   └── scripts/
│       └── initDb.js              # Multi-user database setup
├── client/                        # Frontend React application
│   ├── package.json               # Frontend dependencies
│   ├── public/                    # Static assets
│   └── src/                       # React source code
│       ├── components/            # Enhanced components
│       │   ├── Dashboard.js       # User-specific statistics
│       │   ├── FolderMode.js      # User folder hierarchy
│       │   ├── FileMode.js        # User file management
│       │   ├── SearchPanel.js     # Multi-mode search
│       │   ├── AddFilesMode.js    # Manual file addition
│       │   ├── DeleteMode.js      # Bulk delete operations
│       │   └── VirtualFolderTree.js # Performance-optimized tree
│       ├── services/              # API communication
│       │   └── api.js             # JWT-aware API client
│       ├── App.js                 # Main application with auth
│       └── App.css                # Updated styling
└── .github/
    └── copilot-instructions.md    # Development guidelines
```

## Comparison with Excel/VBA Approach

### Advantages of Multi-User Web Application
✅ **Modern Authentication**: Secure multi-user access with JWT tokens  
✅ **Enhanced Search**: 5 search modes including true fuzzy search  
✅ **Real-time Performance**: Instant filtering and search capabilities  
✅ **Data Isolation**: Each user's data completely separated and secure  
✅ **Scalable Architecture**: Handles large datasets with pagination and indexing  
✅ **Cross-Platform**: Works on Windows, Mac, Linux with any modern browser  
✅ **Production Ready**: Environment-based security and deployment configurations  
✅ **Maintainable**: Version-controlled codebase with comprehensive documentation  

### Migration Benefits for Organizations
- **Multi-User Support**: Replace shared Excel files with individual user accounts
- **Data Security**: User isolation prevents data leakage between users
- **Performance**: SQLite database outperforms Excel for large datasets
- **Search Capabilities**: Advanced search modes unavailable in Excel
- **Deployment**: Single server instance supports multiple concurrent users
- **Backup**: Database backup simpler than managing multiple Excel files
- **Audit Trail**: User-specific operations tracked in scans table

### Technical Superiority
- **Concurrency**: Multiple users can work simultaneously without conflicts
- **Memory Management**: No Excel memory limitations or crashes
- **Search Performance**: FTS5 full-text search vs Excel's basic filtering
- **Data Integrity**: Foreign key constraints and transaction support
- **API Access**: RESTful endpoints for automation and integration
- **Security**: Authentication, authorization, and environment-based policies  
✅ **Scalability**: Handles large datasets with pagination  
✅ **Export Options**: CSV export maintains Excel compatibility  
✅ **Cross-Platform**: Works on Windows, Mac, Linux  
✅ **Maintenance**: Version-controlled codebase  

### Migration Benefits
- **Performance**: Faster than Excel for large datasets
- **Reliability**: No Excel crashes or memory limitations
- **Flexibility**: Easy to add new features and filters
- **Sharing**: Database file is portable and lightweight
- **Automation**: API allows for future automation possibilities

## Future Enhancements

### Phase 2 - Advanced Features (Planned)
- **Document Indexing**: Full-text search within PDF, Word, and text files
- **Media Processing**: Image thumbnail generation and metadata extraction  
- **Duplicate Detection**: Intelligent file duplicate identification algorithms
- **Real-time Sync**: Optional file system monitoring for automatic updates
- **Advanced Analytics**: Detailed usage patterns and storage optimization
- **Bulk Operations**: Multi-file operations with progress tracking

### Phase 3 - Enterprise Features (Future)
- **Plugin Architecture**: Extensible system for custom file processors
- **Cloud Integration**: Optional cloud storage API connections
- **Advanced Access Control**: Role-based permissions and user groups
- **External API**: RESTful endpoints for third-party integrations
- **Audit Logging**: Comprehensive operation logging and reporting
- **Performance Monitoring**: System metrics and optimization tools

### Current Implementation Status
✅ **Phase 1 Complete**: Multi-user authentication, enhanced search, production security  
🔄 **Phase 2 Planning**: Document indexing and advanced analytics in design  
📋 **Phase 3 Roadmap**: Enterprise features for future organizational needs  

## Conclusion

This system design represents a **significant evolution** from single-user Excel/VBA workflows to a **modern, multi-user web application** with:

- **Enterprise-Ready Authentication**: JWT-based security with environment-aware policies
- **Advanced Search Capabilities**: Multiple modes including true fuzzy search
- **Production Deployment**: Comprehensive security and environment configuration  
- **Scalable Architecture**: SQLite optimization with user data isolation
- **Modern Development Stack**: React frontend with Node.js backend

The architecture maintains the **local-only** philosophy while adding **multi-user capabilities**, making it suitable for small teams or organizations that need secure, isolated media database management without cloud dependencies.

**Key Achievement**: Successfully transformed a single-user desktop application concept into a production-ready multi-user web application while preserving the core local-only security model.
