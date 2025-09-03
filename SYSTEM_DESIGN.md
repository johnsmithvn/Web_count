# Media Database Manager - System Design Document

## Overview

This is a comprehensive system design for a **local-only web application** that manages and searches media and folder databases. The application replaces Excel/VBA workflows with a modern, web-based interface.

## Architecture

### Technology Stack
- **Frontend**: React 18 with Ant Design UI library
- **Backend**: Node.js with Express framework
- **Database**: SQLite with optimized indexes
- **Communication**: RESTful API with JSON
- **Development**: Concurrent development server setup

### Key Design Principles
1. **Local-Only Operation**: No cloud dependencies, all data stays on user's machine
2. **Manual Control**: User-triggered scans, no automatic background processes
3. **Dual Mode Operation**: Separate folder-only and file-detail scanning modes
4. **Responsive Search**: Multiple search modes with real-time filtering
5. **Export Capability**: CSV export for external analysis

## Database Schema

### Folders Table
```sql
CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,           -- Full folder path
  name TEXT NOT NULL,                  -- Folder name only
  parent_path TEXT,                    -- Parent folder path
  level INTEGER DEFAULT 0,            -- Depth level in hierarchy
  created_at DATETIME,                -- File system creation date
  modified_at DATETIME,               -- File system modification date
  accessed_at DATETIME,               -- File system access date
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- When this record was created
);
```

### Files Table
```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id INTEGER,                   -- Foreign key to folders.id
  name TEXT NOT NULL,                  -- File name with extension
  extension TEXT,                      -- File extension (.mp4, .jpg, etc.)
  size INTEGER DEFAULT 0,             -- File size in bytes
  created_at DATETIME,                -- File system creation date
  modified_at DATETIME,               -- File system modification date
  accessed_at DATETIME,               -- File system access date
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When this record was created
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

### Scan Operations
- **POST** `/api/scan/folder`
  - **Purpose**: Scan directory structure only (ignore files)
  - **Body**: `{ rootPath, maxDepth }`
  - **Response**: `{ success, message, scannedCount, rootPath }`

- **POST** `/api/scan/file`
  - **Purpose**: Scan files with full metadata
  - **Body**: `{ rootPath, maxDepth, includeExtensions[] }`
  - **Response**: `{ success, message, scannedFolders, scannedFiles, rootPath }`

- **GET** `/api/scan/status`
  - **Purpose**: Get scan status and counts
  - **Response**: `{ folders, files, lastScan }`

### Search Operations
- **GET** `/api/search`
  - **Purpose**: Advanced search with filters
  - **Query Parameters**:
    - `query`: Search term
    - `mode`: exact|fuzzy|regex
    - `caseSensitive`: true|false
    - `searchType`: folders|files|both
    - `extension`: File extension filter
    - `sizeMin/sizeMax`: Size range in bytes
    - `dateFrom/dateTo`: Date range
    - `page/limit`: Pagination
  - **Response**: `{ folders[], files[], totalFolders, totalFiles, pagination }`

- **GET** `/api/search/extensions`
  - **Purpose**: Get all file extensions with counts
  - **Response**: `[{ extension, count }]`

### Delete Operations
- **DELETE** `/api/delete/`
  - **Purpose**: Delete data by root path and type
  - **Body**: `{ rootPath, deleteType }`
  - **Response**: `{ success, message, deletedFolders, deletedFiles }`

- **DELETE** `/api/delete/all`
  - **Purpose**: Delete all data from database
  - **Response**: `{ success, message, deletedFolders, deletedFiles }`

- **POST** `/api/delete/preview`
  - **Purpose**: Preview data that would be deleted
  - **Body**: `{ rootPath, deleteType }`
  - **Response**: `{ folders[], files[], totalFolders, totalFiles }`

### Statistics Operations
- **GET** `/api/stats`
  - **Purpose**: Database statistics and analytics
  - **Response**: Complex object with summary, distributions, and insights

- **GET** `/api/stats/path?path=`
  - **Purpose**: Detailed statistics for specific folder
  - **Response**: `{ folder, files, fileTypes, subfolders }`

- **GET** `/api/stats/export?type=files|folders&format=csv`
  - **Purpose**: Export data to CSV
  - **Response**: CSV file download

### Health Check
- **GET** `/api/health`
  - **Purpose**: Server status check
  - **Response**: `{ status: "OK", message }`

## Frontend Architecture

### Component Structure
```
src/
├── components/
│   ├── Dashboard.js          # Statistics overview with charts
│   ├── FolderMode.js         # TreeView for folder hierarchy
│   ├── FileMode.js           # DataTable for file listings
│   └── SearchPanel.js        # Search controls and scan triggers
├── services/
│   └── api.js                # API communication layer
├── App.js                    # Main application layout
└── App.css                   # Custom styling
```

### Key Features

#### Dashboard Tab
- **Summary Cards**: Total folders, files, size, last scan
- **File Type Distribution**: Pie chart of extensions
- **Size Distribution**: Bar chart of file size ranges
- **Largest Files**: Top 10 by size
- **Busiest Folders**: Most files per folder

#### Folder Mode Tab
- **TreeView Display**: Hierarchical folder structure
- **Interactive Selection**: Click to view folder details
- **Expandable Nodes**: Show/hide subfolders
- **Details Panel**: Selected folder metadata
- **Copy Path Utility**: One-click path copying

#### File Mode Tab
- **Data Table**: Sortable, filterable file listing
- **Column Management**: Show/hide columns
- **Pagination**: Handle large datasets efficiently
- **Extension Filtering**: Filter by file type
- **Size Formatting**: Human-readable file sizes
- **Copy Path Utility**: Full file path copying

#### Search Panel
- **Global Search Bar**: Query input with mode selection
- **Advanced Filters**:
  - Search modes: exact, fuzzy, regex
  - Case sensitivity toggle
  - Extension filtering
  - Size range filtering
  - Date range filtering
- **Scan Controls**: Manual folder/file scanning
- **Delete Controls**: Delete data by root path with preview
- **Export Options**: CSV download

## User Workflows

### Initial Setup
1. User opens `http://localhost:3000`
2. Clicks "Scan Folders" button
3. Enters root directory path (e.g., `D:\Media`)
4. Selects scan type (folder-only or file-detail)
5. Configures scan depth and extensions (optional)
6. Initiates scan

### Daily Usage
1. **Browse**: Switch between Dashboard, Folder, and File tabs
2. **Search**: Use search panel to find specific items
3. **Analyze**: View statistics and distributions
4. **Export**: Download data for external analysis
5. **Rescan**: Update database when filesystem changes

### Search Operations
1. **Quick Search**: Enter term in search bar, select mode
2. **Filter Results**: Apply extension, size, or date filters
3. **Review Results**: Browse folders/files in respective tabs
4. **Copy Paths**: Use copy buttons for file operations
5. **Clear Results**: Return to full dataset view

## Performance Considerations

### Database Optimization
- SQLite WAL mode for concurrent read/write
- Strategic indexing on frequently queried columns
- Prepared statements for repeated operations
- Foreign key constraints for data integrity

### Frontend Optimization
- Pagination for large datasets (50-200 items per page)
- Virtual scrolling for tree views
- Debounced search input
- Lazy loading for charts and statistics

### Scanning Optimization
- Configurable scan depth to prevent infinite recursion
- Error handling for permission-denied folders
- Progress feedback through console logging
- Asynchronous file system operations

## Security Considerations

### Local-Only Design
- No network communication except localhost
- No external API calls or data transmission
- SQLite database file stored locally
- User controls all data access

### File System Access
- User explicitly provides scan paths
- Graceful handling of permission errors
- No automatic filesystem monitoring
- Read-only operations on scanned files

## Deployment Instructions

### Prerequisites
- Node.js 16+ installed
- NPM package manager
- Modern web browser (Chrome, Firefox, Edge)

### Installation
```bash
# Clone/download project
cd media-database-manager

# Install all dependencies
npm run install:all

# Initialize database
npm run db:init

# Start development servers
npm run dev
```

### Production Build
```bash
# Build React frontend
npm run build

# Start production server
npm start

# Access application
# http://localhost:5000
```

## File Structure
```
media-database-manager/
├── package.json              # Root package configuration
├── README.md                 # Project documentation
├── server/                   # Backend Node.js application
│   ├── package.json         # Server dependencies
│   ├── index.js             # Express server setup
│   ├── database.db          # SQLite database file
│   ├── routes/              # API route handlers
│   │   ├── scan.js          # Folder/file scanning endpoints
│   │   ├── search.js        # Search and filtering endpoints
│   │   ├── stats.js         # Statistics and export endpoints
│   │   └── delete.js        # Delete operations with preview
│   └── scripts/
│       └── initDb.js        # Database initialization
├── client/                  # Frontend React application
│   ├── package.json         # Frontend dependencies
│   ├── public/              # Static assets
│   └── src/                 # React source code
│       ├── components/      # React components
│       ├── services/        # API communication
│       ├── App.js          # Main application
│       └── App.css         # Styling
└── .github/
    └── copilot-instructions.md  # Development notes
```

## Comparison with Excel/VBA Approach

### Advantages
✅ **Modern UI**: Web-based interface with responsive design  
✅ **Real-time Search**: Instant filtering and search capabilities  
✅ **Data Persistence**: SQLite database with relational structure  
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

### Phase 2 Features
- File content indexing for documents
- Image thumbnail generation
- Duplicate file detection
- Scheduled automatic scans
- Advanced analytics and reporting

### Phase 3 Features
- Plugin system for custom file processors
- Integration with cloud storage APIs
- Multi-user support with access controls
- RESTful API for external integrations

This design provides a robust foundation for managing media collections while maintaining the simplicity and local-only nature required by the specification.
