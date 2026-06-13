# Media Database Manager — Phân tích chi tiết cách hoạt động

> **Version:** 1.1.0 | **Verified from source code:** 2026-06-13
> Tài liệu giải thích **cách hệ thống lưu dữ liệu**, **logic scan**, **các chế độ search**, và **các tab hiển thị** — dành cho người dùng.

---

## MỤC LỤC

1. [Mô hình lưu dữ liệu](#1-mô-hình-lưu-dữ-liệu)
2. [Logic Scan — Quét dữ liệu](#2-logic-scan--quét-dữ-liệu)
3. [Hệ thống Search](#3-hệ-thống-search)
4. [Các Tab hiển thị (Display Modes)](#4-các-tab-hiển-thị)
5. [Quản lý dữ liệu (Delete + Add)](#5-quản-lý-dữ-liệu)
6. [Luồng tổng thể](#6-luồng-tổng-thể)

---

## 1. Mô hình lưu dữ liệu

### Ứng dụng này LÀM GÌ?

Ứng dụng **quét filesystem** trên máy tính (folders, files) rồi **lưu thông tin metadata** (tên, kích thước, ngày tạo...) vào **database SQLite**. Sau đó bạn có thể tìm kiếm, thống kê, quản lý dữ liệu đó qua giao diện web.

> ⚠️ **Ứng dụng KHÔNG di chuyển/xóa file thật trên ổ cứng.** Nó chỉ lưu **metadata** (thông tin mô tả) vào database. Khi bạn "xóa" trong app, nó chỉ xóa record trong DB, file thật trên ổ cứng KHÔNG bị ảnh hưởng.

### Cấu trúc database

```
                    ┌──────────────────┐
                    │     users        │  ← Mỗi user có tài khoản riêng
                    │  id, username,   │
                    │  password, ...   │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │   scans    │  │  folders   │  │            │
     │ Lịch sử   │  │ Thư mục   │  │            │
     │ quét       │  │ metadata  │  │            │
     └────────────┘  └──────┬─────┘  │            │
                            │         │            │
                            ▼         │            │
                     ┌────────────┐   │            │
                     │   files    │   │            │
                     │ File       │   │            │
                     │ metadata  │   │            │
                     └────────────┘   │            │
```

### 4 bảng chính

| Bảng | Lưu gì | Ví dụ data |
|------|--------|-----------|
| **users** | Tài khoản đăng nhập | `admin / admin` (mặc định) |
| **scans** | Lịch sử mỗi lần quét | "Ngày 13/6/2026, quét `E:\Media`, 500 folders, 3000 files" |
| **folders** | Thông tin từng thư mục | path=`E:\Media\Anime`, level=2, modified=2025-12-01 |
| **files** | Thông tin từng file | name=`video.mp4`, size=1.5GB, extension=`.mp4` |

### Quan hệ sở hữu (QUAN TRỌNG)

```
File thuộc về ai?

files.folder_id ──→ folders.id ──→ folders.user_id ──→ users.id

Ví dụ:
  file "movie.mp4" (folder_id = 42)
  → folder #42: "E:\Media\Movies" (user_id = 1)
  → user #1: "admin"
  
  ⇒ "movie.mp4" thuộc về user "admin"
```

> **Ghi nhớ:** Table `files` KHÔNG có cột `user_id`. Để biết file thuộc user nào, phải đi qua bảng `folders`.

### Mỗi user thấy gì?

Mỗi user **chỉ thấy dữ liệu của mình**. User A quét ổ `D:\`, user B quét ổ `E:\` — hai người không thấy dữ liệu của nhau.

---

## 2. Logic Scan — Quét dữ liệu

### Có 2 chế độ scan

```
┌────────────────────────────────────────────────────────┐
│                    SCAN MODAL                          │
│                                                        │
│  📁 Scan Type: [Folder Only ▼]                        │
│                                                        │
│  📂 Root Path: [E:\Media                         ]     │
│                                                        │
│  🔢 Max Depth: [10]                                   │
│                                                        │
│  📝 Include Extensions: [.mp4] [.mkv] [.avi]          │
│  🚫 Exclude Extensions: [.tmp] [.log]                 │
│                                                        │
│                              [Cancel]  [Start Scan]    │
└────────────────────────────────────────────────────────┘
```

#### Mode 1: 📁 Folder Only (Structure)

**Mục đích:** Quét nhanh cấu trúc thư mục, KHÔNG quét files bên trong.

**Luồng thực thi:**

```
Bước 1: Xóa folders cũ có path bắt đầu bằng rootPath
         DELETE FROM folders WHERE user_id = ? AND path LIKE 'E:\Media%'

Bước 2: Duyệt filesystem đệ quy
         E:\Media\              ← level 0, insert
         E:\Media\Anime\        ← level 1, insert
         E:\Media\Anime\Show A\ ← level 2, insert
         ...
         
Bước 3: Ghi lịch sử scan
         INSERT INTO scans (user_id, root_path, status, folders_count, ...)

Bước 4: Trả response
         { success: true, scannedCount: 150, rootPath: "E:\Media" }
```

**Đặc điểm:**
- ✅ Nhanh (chỉ đọc danh sách folder, không mở file)
- ✅ **Giữ nguyên file data đã có** trong DB
- ❌ Không lưu thông tin file (name, size, extension...)
- ⚡ Phù hợp khi bạn chỉ muốn xem cây thư mục

---

#### Mode 2: 📄 File Detail (With Metadata)

**Mục đích:** Quét cả folders + files, lưu metadata đầy đủ (tên, kích thước, ngày sửa...)

**Luồng thực thi:**

```
Bước 1: XÓA TẤT CẢ dữ liệu cũ trong rootPath
         DELETE FROM files WHERE folder_id IN (
           SELECT id FROM folders WHERE user_id = ? AND path LIKE 'E:\Media%'
         )
         DELETE FROM folders WHERE user_id = ? AND path LIKE 'E:\Media%'

Bước 2: Duyệt filesystem đệ quy
         Với MỖI folder:
           ① Insert folder → lấy folder.id
           ② Duyệt file bên trong
           ③ Lọc theo includeExtensions / excludeExtensions
           ④ Insert file (name, extension, size, folder_id, timestamps)

Bước 3: Ghi lịch sử scan
         INSERT INTO scans (... folders_count, files_count, scan_options ...)

Bước 4: Trả response
         { success: true, scannedFolders: 150, scannedFiles: 3000, rootPath: "E:\Media" }
```

**Đặc điểm:**
- ⚠️ **Xóa toàn bộ data cũ** trong rootPath trước khi quét lại
- ✅ Lưu đầy đủ: tên file, extension, size, ngày tạo/sửa/truy cập
- ✅ Có thể lọc extension (chỉ quét .mp4, .mkv hoặc loại trừ .tmp, .log)
- 🐢 Chậm hơn Mode 1 (phải đọc metadata từng file)

### So sánh 2 chế độ scan

| | Folder Only | File Detail |
|---|---|---|
| **Tốc độ** | ⚡ Nhanh | 🐢 Chậm |
| **Lưu folders** | ✅ Có | ✅ Có |
| **Lưu files** | ❌ Không | ✅ Có |
| **Xóa data cũ** | Chỉ xóa folders | Xóa cả folders + files |
| **Include/Exclude ext** | Không ảnh hưởng | ✅ Hoạt động |
| **Use case** | Xem cây thư mục | Tìm kiếm + thống kê file |

### Metadata được lưu

Với mỗi **folder**, lưu:
| Field | Nguồn | Ví dụ |
|-------|-------|-------|
| path | `fs.statSync()` | `E:\Media\Anime\Show A` |
| name | `path.basename()` | `Show A` |
| parent_path | `path.dirname()` | `E:\Media\Anime` |
| level | tính từ root | `2` (root=0) |
| created_at | `stat.birthtime` | `2024-01-15T08:30:00` |
| modified_at | `stat.mtime` | `2025-06-01T14:20:00` |
| accessed_at | `stat.atime` | `2026-06-13T10:00:00` |

Với mỗi **file** (chỉ Mode 2), lưu:
| Field | Nguồn | Ví dụ |
|-------|-------|-------|
| name | filename | `episode 01.mp4` |
| extension | `path.extname()` | `.mp4` |
| size | `stat.size` (bytes) | `734003200` (700MB) |
| folder_id | FK → folders.id | `42` |
| created_at | `stat.birthtime` | `2024-01-15T08:30:00` |
| modified_at | `stat.mtime` | `2025-06-01T14:20:00` |

### Hành vi khi scan lại cùng rootPath

| Scenario | Kết quả |
|----------|---------|
| Scan Folder → Scan Folder lại | Xóa folders cũ → quét lại. File data giữ nguyên (nhưng folder_id có thể thay đổi!) |
| Scan File → Scan File lại | Xóa TẤT CẢ (folders + files) → tạo mới hoàn toàn |
| Scan File → Scan Folder | Chỉ xóa/update folders. File data giữ nguyên |
| Scan Folder → Scan File | Xóa cả folders + files → tạo mới |

---

## 3. Hệ thống Search

### Cách hoạt động tổng quan

```
SearchPanel ──(params)──→ App.js ──(API call)──→ Server
                                                    │
                                                    ▼
                                          GET /api/search?query=star&mode=contains&...
                                                    │
                                                    ▼
                                          SQL: SELECT * FROM folders/files
                                          WHERE name LIKE '%star%'
                                                    │
                                                    ▼
App.js ←──(results)────────────────────── { folders: [...], files: [...] }
  │
  ├──→ VirtualFolderTree (Folder Mode tab)
  ├──→ FolderTableMode (Folder Table tab)
  └──→ FileMode (File Mode tab)
```

### 4 chế độ Search

| Mode | SQL Pattern | Ví dụ |
|------|------------|-------|
| **Exact Match** | `name = 'star wars'` | Chỉ tìm tên chính xác "star wars" |
| **Contains** (mặc định) | `name LIKE '%star wars%'` | Tìm bất kỳ tên nào chứa "star wars" |
| **Word-based** | `name LIKE '%star%' AND name LIKE '%wars%'` | Tách từ, ALL phải match. "star wars" match "My Star Wars Collection" |
| **Regex** | `name LIKE '%pattern%'` | Thực chất vẫn là LIKE (SQLite không có REGEXP mặc định) |

### Các filter search

Tất cả filter nằm trong **Settings Modal** (nút ⚙️):

| Filter | Mô tả | Ví dụ |
|--------|--------|-------|
| **Search Mode** | 4 mode ở trên | `contains` |
| **Search In** | Tìm trong Name, Path, hoặc cả hai | `both` |
| **Search Type** | Tìm Folders, Files, hoặc cả hai | `both` |
| **Root Paths** | Giới hạn trong root path nào | Chỉ tìm trong `E:\Media` |
| **Case Sensitive** | Phân biệt chữ hoa/thường | `OFF` mặc định |
| **Extension** | Lọc theo đuôi file | `.mp4` |
| **Size Range** | Lọc theo kích thước (bytes) | 1000000 - 999999999 |
| **Date Range** | Lọc theo ngày sửa | 2025-01-01 → 2026-01-01 |
| **Result Limit** | Giới hạn số kết quả | `100` (mặc định) |
| **Ancestor Levels** | Hiển thị bao nhiêu level cha trong Folder Mode | `1` (mặc định) |
| **Ancestor Mode** | Cách tính ancestor: từ gốc hay từ kết quả | `from-root` |

### Ancestor Levels — giải thích

Ancestor Levels quyết định **bao nhiêu level folder cha** được trả về cùng kết quả tìm kiếm. Điều này ảnh hưởng đến **Folder Mode** và **Folder Table**.

**Ví dụ:** Tìm "Episode 01" → match ở `E:\Media\Anime\Show A\Season 1\Episode 01`

| Ancestor Levels | Mode | Kết quả hiển thị |
|-----------------|------|-----------------|
| 0 (tắt) | — | Chỉ folder chứa file match |
| 1 | from-root | `E:\` → `Media` |
| 2 | from-root | `E:\` → `Media` → `Anime` |
| 3 | from-root | `E:\` → `Media` → `Anime` → `Show A` |
| 1 | from-match | `Season 1` (1 cấp trên match) |
| 2 | from-match | `Show A` → `Season 1` |

---

## 4. Các Tab hiển thị

App có **7 tab** (6 cho mọi user + 1 admin-only):

### Tab 1: 📊 Dashboard

**Component:** `Dashboard.js` (20KB)
**Mục đích:** Tổng quan thống kê — xem nhanh trạng thái database

**Hiển thị:**
- 4 thẻ tóm tắt: Total Folders, Total Files, Total Size, Last Scan
- Biểu đồ tròn (Pie): phân bố theo extension (top 10)
- Biểu đồ cột (Bar): phân bố theo kích thước file
- Bảng Largest Files (10 file lớn nhất)
- Bảng Busiest Folders (10 folder nhiều file nhất)
- Bảng "Danh sách đường dẫn đã quét" — lịch sử scan, click để xem chi tiết + xóa

**Data source:** `GET /api/stats` + `GET /api/stats/root-paths`
**Khi nào cập nhật:** Tự động load khi mở tab, refresh khi scan xong

---

### Tab 2: 🌳 Folder Mode (Virtual Folder Tree)

**Component:** `VirtualFolderTree.js` (18KB)
**Mục đích:** Hiển thị cấu trúc thư mục dạng cây (tree), có thể mở rộng/thu gọn

**Hai trạng thái:**

| Trạng thái | Nguồn data | Hành vi |
|------------|-----------|---------|
| **Chưa search** | `GET /api/search/folders/root` | Hiển thị root folders, lazy load khi mở |
| **Sau search** | `searchResults.folders` | Hiển thị cây kết quả, auto-expand đến match, highlight kết quả |

**Tính năng:**
- **Lazy loading:** Click folder → gọi API `GET /api/search/children/:path` lấy subfolder
- **Highlight:** Folder match được tô đỏ + in đậm
- **Auto-expand:** Khi search, tự mở rộng cây đến vị trí match
- **Filter nội bộ:** Thanh search trong tab để lọc nhanh theo tên
- **Expand/Collapse All:** 2 nút để mở/đóng tất cả
- **Export CSV:** Xuất danh sách folder ra file CSV
- **Click folder → Modal:** Xem chi tiết (path, level, timestamps) + Copy Path

---

### Tab 3: 📋 Folder Table

**Component:** `FolderTableMode.js` (12KB)
**Mục đích:** Hiển thị cấu trúc folder dạng bảng phẳng — mỗi level là 1 cột

**Ví dụ hiển thị:**

| Root Path | Level 2 | Level 3 | Level 4 | Files |
|-----------|---------|---------|---------|-------|
| E:\ | Media | Anime | Show A | ep01.mp4 |
| E:\ | Media | Anime | Show B | ep01.mkv |
| E:\ | Media | Movies | Action | movie.mp4 |

**Tính năng:**
- Tự tạo cột level động (level 1, 2, 3... tùy dữ liệu)
- Click ô → copy nội dung
- Click file → copy full path
- Ẩn/hiện cột (nút ⚙️)
- Highlight row match (nền vàng)
- **Chỉ hiển thị sau khi search** (không có default view)

**Data source:** Cùng `searchResults` với Folder Mode

---

### Tab 4: 📄 File Mode

**Component:** `FileMode.js` (8KB)
**Mục đích:** Hiển thị danh sách file dạng bảng với đầy đủ thông tin

**Bảng hiển thị:**

| Name | Folder Path | Ext | Size | Modified | Actions |
|------|-------------|-----|------|----------|---------|
| movie.mp4 | E:\Media\Movies | MP4 | 1.5 GB | 01/06/2025 | 📋 |

**Tính năng:**
- Click tên file → copy tên
- Click folder path → copy path
- Nút 📋 → copy full path (folder + filename)
- Extension tag có màu theo loại (video=đỏ, audio=xanh, ảnh=green...)
- Sort theo Name, Size, Modified date
- Filter theo extension (dropdown)
- **Server-side pagination:** Chuyển trang gọi API mới (không load hết vào client)
- Export CSV

**Data source:** `searchResults.files`
**Chỉ hiển thị sau khi search**

---

### Tab 5: 🗑️ Delete Files

**Component:** `DeleteMode.js` (10KB)
**Mục đích:** Tìm và xóa file **trong database** theo tên

**Luồng sử dụng:**

```
1. Nhập tên file (vd: "trailer")
2. Chọn mode: Contains hoặc Exact Match
3. Bấm Search → hiện danh sách file match
4. Bấm "Delete All (N)" → xác nhận → xóa từng file bằng API
```

**Lưu ý:**
- Search chỉ theo **file name** (không tìm theo path)
- Xóa từng file bằng `DELETE /api/delete/file/:id` (vòng lặp)
- **CHỈ xóa record trong DB, KHÔNG xóa file thật trên ổ cứng**

---

### Tab 6: ➕ Add Files

**Component:** `AddFilesMode.js` (8KB)
**Mục đích:** Thêm file/folder thủ công vào database (không cần scan)

**Use case:** Khi muốn thêm 1-2 file mà không cần scan lại cả folder

**Form fields:**
- **Name** (bắt buộc): `episode 01.mp4`
- **Path** (bắt buộc): `E:\Media\Anime\Show A`
- **Extension** (auto-fill): Tự điền từ tên file
- **Size** (tùy chọn): bytes
- **Priority** (tùy chọn): Low/Normal/High/Urgent
- **Timestamps** (tùy chọn): Created, Modified, Accessed

---

### Tab 7: 👑 Admin (Admin-only)

**Component:** `AdminUserManagement.js` (8KB)
**Mục đích:** Quản lý user — chỉ hiển thị cho tài khoản admin

**Tính năng:**
- Danh sách user với thống kê (scan count, folder count, file count)
- Reset password cho user khác
- Xóa user + tất cả dữ liệu liên quan (transaction-safe)
- Không cho phép xóa chính mình

---

## 5. Quản lý dữ liệu

### Xóa dữ liệu có 4 cách

| Cách | Nơi thực hiện | Xóa gì |
|------|---------------|--------|
| **Delete by Root Path** | SearchPanel → "Delete Data" button | Tất cả folders + files trong 1 root path |
| **Delete by File Name** | Tab "Delete Files" | Từng file theo tên |
| **Delete from Dashboard** | Tab Dashboard → Xem chi tiết → Xóa | Toàn bộ data của 1 root path |
| **Delete All** | API `/delete/all` | Toàn bộ data của user hiện tại |

### Thêm dữ liệu có 3 cách

| Cách | Nơi thực hiện | Thêm gì |
|------|---------------|---------|
| **Scan** | SearchPanel → "Scan Folders" | Tự động quét filesystem |
| **Add File** | Tab "Add Files" | 1 file thủ công |
| **Add Folder** | Tab "Add Files" (form riêng) | 1 folder thủ công |

---

## 6. Luồng tổng thể

### Luồng người dùng điển hình

```
                        ┌─────────────┐
                        │  Đăng nhập  │
                        │ admin/admin │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  Scan Folder│ ← Quét cấu trúc thư mục trước
                        │  E:\Media   │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  Scan File  │ ← Quét chi tiết file (nếu cần)
                        │  E:\Media   │
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
       │  Dashboard  │ │   Search    │ │  Folder     │
       │  Xem thống  │ │   Tìm kiếm │ │  Mode / Tree│
       │  kê tổng    │ │   theo tên  │ │  Xem cây    │
       └─────────────┘ └──────┬──────┘ └─────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
       ┌──────▼──────┐ ┌─────▼───────┐ ┌─────▼───────┐
       │ File Mode   │ │Folder Table │ │ Delete Mode │
       │ Xem file    │ │Xem folder   │ │ Xóa file    │
       │ dạng bảng   │ │ dạng bảng   │ │ theo tên    │
       └─────────────┘ └─────────────┘ └─────────────┘
```

### Data flow tóm tắt

```
Filesystem (ổ cứng)
      │
      │  Scan (user bấm nút)
      ▼
SQLite Database (server/database.db)
      │
      │  REST API (Express)
      ▼
React Frontend (Browser)
      │
      │  7 Tabs hiển thị
      ▼
Người dùng xem/tìm/quản lý dữ liệu
```
