# Media Database Manager - Local Web Application

This is a local-only web application for managing and searching media and folder databases. It replaces Excel/VBA workflows with a modern web interface.

## Project Structure

- Backend: Node.js with Express
- Frontend: React with Ant Design
- Database: SQLite with FTS5
- Two scan modes: Folder-only and File-detail

## Features

- Local-only operation (no cloud dependency)
- Manual scan triggers
- Advanced search with multiple modes
- Dashboard with statistics
- TreeView for folders, DataTable for files
- Export capabilities

## Development Notes

- All scans are manual (no auto-sync)
- SQLite database for portability
- FTS5 enabled for full-text search
- Localhost browser access

## Development Guidelines

### Code Changes Protocol

**QUAN TRỌNG**: Mỗi khi thực hiện fix bug, thêm feature, hoặc sửa đổi code, PHẢI cập nhật CHANGELOG.md

#### Quy trình bắt buộc:
1. **Trước khi fix/sửa**: Ghi nhận vấn đề trong CHANGELOG.md dưới mục `[Unreleased]`
2. **Sau khi fix/sửa**: Cập nhật CHANGELOG.md với chi tiết thay đổi
3. **Khi release**: Di chuyển từ `[Unreleased]` sang version mới

#### Format changelog entry:
```markdown
### Fixed
- 🐛 [YYYY-MM-DD] Fixed [mô tả vấn đề] → [giải pháp]

### Added  
- ✨ [YYYY-MM-DD] Added [tính năng mới] - [mô tả chi tiết]

### Changed
- 🔄 [YYYY-MM-DD] Changed [thay đổi gì] - [lý do]

### Removed
- 🗑️ [YYYY-MM-DD] Removed [xóa gì] - [lý do]
```

### File Organization Rules

1. **Route Files**: Chỉ giữ 3 file chính trong `server/routes/`:
   - `scan.js` - Scanning operations
   - `search.js` - Search functionality  
   - `stats.js` - Statistics và export

2. **Component Files**: Trong `client/src/components/`:
   - `Dashboard.js` - Statistics overview
   - `FolderMode.js` - TreeView cho folders
   - `FileMode.js` - DataTable cho files
   - `SearchPanel.js` - Search controls

3. **No Duplicate Files**: Không tạo file backup (-simple, -sqlite3, etc.)

### API Endpoint Standards

- Tất cả endpoints bắt đầu với `/api/`
- RESTful conventions: GET cho read, POST cho write
- Consistent error handling với try-catch
- Proper HTTP status codes

### Database Standards

- SQLite với WAL mode
- Foreign key constraints enabled
- Proper indexes cho performance
- Consistent datetime handling

### Frontend Standards

- Ant Design components priority
- Modern React hooks (no class components)
- Proper error boundaries
- Responsive design considerations

### Git Workflow

1. **Before any commit**: Update CHANGELOG.md
2. **Commit message format**: 
   ```
   feat: [description]
   fix: [description] 
   docs: [description]
   refactor: [description]
   ```
3. **Always reference changelog**: "See CHANGELOG.md for details"

### Documentation Updates

- README.md: User-facing documentation
- SYSTEM_DESIGN.md: Technical architecture
- CHANGELOG.md: All changes (REQUIRED)
- This file: Development guidelines

### Testing Protocol

- Test all API endpoints after changes
- Verify frontend components render correctly
- Check database operations
- Test concurrent development setup

### Deployment Checklist

1. ✅ Update CHANGELOG.md với release version
2. ✅ Test `npm run dev` works
3. ✅ Test `npm run build` succeeds
4. ✅ Verify database initialization
5. ✅ Update README.md if needed
6. ✅ Tag release in git

---

**Remember**: CHANGELOG.md is not optional - it's required for every code change!
