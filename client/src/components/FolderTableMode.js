import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Button,
  message,
  Empty,
  Popover,
  Checkbox,
} from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { copyToClipboard } from '../utils/clipboard';

const normalizePath = (path) => {
  if (typeof path !== 'string') return '';
  return path.replace(/\//g, '\\');
};

const splitPathSegments = (path) => {
  if (typeof path !== 'string') return [];
  return normalizePath(path).split(/[\\/]+/).filter(Boolean);
};

const getParentPath = (path) => {
  const segments = splitPathSegments(path);
  if (segments.length <= 1) {
    return null;
  }
  return segments.slice(0, -1).join('\\');
};

const getLevelFromPath = (path) => {
  const segments = splitPathSegments(path);
  return Math.max(0, segments.length - 1);
};

const getFolderLabel = (folder) => {
  if (!folder) return '';
  if (folder.level === 0) {
    return folder.path || folder.name || '';
  }
  if (folder.name) return folder.name;
  if (folder.path) {
    const segments = splitPathSegments(folder.path);
    return segments.length > 0 ? segments[segments.length - 1] : folder.path;
  }
  return '';
};

const getFileDisplayName = (file) => file?.name || file?.file_name || file?.filename || '';

const buildFullFilePath = (folderPath, fileName) => {
  if (!folderPath) return fileName || '';
  if (!fileName) return folderPath;
  const normalized = normalizePath(folderPath);
  const separator = normalized.endsWith('\\') ? '' : '\\';
  return `${normalized}${separator}${fileName}`;
};

const FolderTableMode = ({ searchResults }) => {
  const [visibleColumnKeys, setVisibleColumnKeys] = useState([]);

  const combinedFolders = useMemo(() => {
    if (!searchResults) return [];
    const map = new Map();

    const ensureEntry = (rawPath) => {
      const normalized = normalizePath(rawPath);
      if (!normalized) return null;
      if (map.has(normalized)) return map.get(normalized);

      const entry = {
        path: normalized,
        parent_path: getParentPath(normalized),
        level: getLevelFromPath(normalized),
        name: getFolderLabel({ path: normalized }),
        files: [],
        isVirtual: true,
      };

      map.set(normalized, entry);

      if (entry.parent_path) {
        ensureEntry(entry.parent_path);
      }

      return entry;
    };

    const mergeFolder = (folder) => {
      if (!folder?.path) return;
      const normalized = normalizePath(folder.path);
      const existing = map.get(normalized) || {};
      const normalizedParent = folder.parent_path ? normalizePath(folder.parent_path) : getParentPath(normalized);
      const parentPath = normalizedParent || null;
      const merged = {
        ...existing,
        ...folder,
        path: normalized,
        parent_path: parentPath,
        level: Number.isFinite(folder.level) ? folder.level : (existing.level ?? getLevelFromPath(normalized)),
      };

      const folderFiles = Array.isArray(folder.files) ? folder.files : [];
      merged.files = folderFiles.length ? folderFiles : (existing.files || []);

      map.set(normalized, merged);

      if (parentPath) {
        ensureEntry(parentPath);
      }
    };

    if (Array.isArray(searchResults?.folders)) {
      searchResults.folders.forEach(mergeFolder);
    }

    const filesByFolder = new Map();
    (searchResults?.files || []).forEach((file) => {
      const folderPath = file?.folder_path;
      if (!folderPath) return;
      const normalized = normalizePath(folderPath);
      if (!filesByFolder.has(normalized)) {
        filesByFolder.set(normalized, []);
      }
      filesByFolder.get(normalized).push(file);
      ensureEntry(normalized);
    });

    filesByFolder.forEach((filesForFolder, normalized) => {
      const existing = ensureEntry(normalized);
      const nextFiles = [...(existing.files || []), ...filesForFolder];
      map.set(normalized, { ...existing, files: nextFiles });
    });

    return Array.from(map.values());
  }, [searchResults]);

  const folderMap = useMemo(() => {
    const map = new Map();
    combinedFolders.forEach(folder => {
      if (folder?.path) {
        map.set(normalizePath(folder.path), folder);
      }
    });
    return map;
  }, [combinedFolders]);

  const highlightPaths = useMemo(
    () => new Set((searchResults?.highlightPaths || []).map(normalizePath)),
    [searchResults?.highlightPaths]
  );

  const focusPaths = useMemo(() => {
    if (!searchResults) return null;
    const paths = new Set();

    const addPathChain = (path) => {
      const normalized = normalizePath(path);
      if (!normalized || paths.has(normalized)) return;
      paths.add(normalized);
      const parent = folderMap.get(normalized)?.parent_path;
      if (parent && !paths.has(parent)) {
        addPathChain(parent);
      }
    };

    (searchResults.folders || []).forEach(folder => {
      if (folder?.path) addPathChain(folder.path);
    });

    (searchResults.files || []).forEach(file => {
      if (file?.folder_path) addPathChain(file.folder_path);
    });

    (searchResults.expandPaths || []).forEach(addPathChain);
    (searchResults.anchorPaths || []).forEach(addPathChain);
    (searchResults.showAllFromPaths || []).forEach(addPathChain);

    return paths;
  }, [folderMap, searchResults]);

  const dataSource = useMemo(() => {
    const relevantFolders = focusPaths ? combinedFolders.filter(folder => focusPaths.has(folder.path)) : combinedFolders;

    const maxLevel = relevantFolders.reduce((max, folder) => {
      const lvl = Number.isFinite(folder?.level) ? folder.level : 0;
      return Math.max(max, lvl);
    }, 0);

    const rows = relevantFolders.map(folder => {
      const row = {
        key: folder.path,
        path: folder.path,
        level: folder.level,
        files: Array.isArray(folder.files) ? folder.files : [],
      };

      let current = folder;
      let safety = 0;
      while (current && safety < 200) {
        const levelIndex = Number.isFinite(current.level) ? current.level : 0;
        row[`level_${levelIndex}`] = getFolderLabel(current);
        if (!current.parent_path) break;
        current = folderMap.get(normalizePath(current.parent_path));
        safety += 1;
      }

      // Ensure root column is filled even if traversal failed
      if (!row.level_0 && folder?.path) {
        const rootSegments = splitPathSegments(folder.path);
        row.level_0 = rootSegments.length > 0 ? rootSegments[0] : folder.path;
      }

      // Precompute cells for every level up to max to keep table aligned
      for (let i = 0; i <= maxLevel; i += 1) {
        if (!Object.prototype.hasOwnProperty.call(row, `level_${i}`)) {
          row[`level_${i}`] = '';
        }
      }

      return row;
    });

    return { rows, maxLevel };
  }, [combinedFolders, focusPaths, folderMap]);

  const allColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i <= dataSource.maxLevel; i += 1) {
      const levelIndex = i;
      cols.push({
        title: levelIndex === 0 ? 'Root Path' : `Level ${levelIndex + 1}`,
        dataIndex: `level_${levelIndex}`,
        key: `level_${levelIndex}`,
        onCell: (record) => {
          const cellValue = record[`level_${levelIndex}`];
          return {
            onClick: () => {
              if (cellValue) {
                copyToClipboard(cellValue, 'Đã sao chép nội dung!');
              }
            },
            style: cellValue ? { cursor: 'pointer' } : {},
          };
        },
        render: (value) => (
          value ? (
            <Typography.Text style={{ cursor: 'pointer' }} title={value}>
              {value}
            </Typography.Text>
          ) : null
        ),
      });
    }

    cols.push({
      title: 'Files',
      dataIndex: 'files',
      key: 'files',
      render: (files, record) => {
        if (!files || files.length === 0) return null;
        return (
          <Space direction="vertical" size={4}>
            {files.map((file, index) => {
              const displayName = getFileDisplayName(file);
              if (!displayName) return null;
              const fullPath = buildFullFilePath(file.folder_path || record.path, displayName);
              const fileKey = `${displayName}-${index}`;
              return (
                <Typography.Text
                  key={fileKey}
                  style={{ cursor: 'pointer' }}
                  title={`Nhấn để sao chép đường dẫn: ${fullPath}`}
                  onClick={() => copyToClipboard(fullPath, 'Đã sao chép đường dẫn đầy đủ!')}
                >
                  {displayName}
                </Typography.Text>
              );
            })}
          </Space>
        );
      },
    });

    return cols;
  }, [dataSource.maxLevel]);

  useEffect(() => {
    const nextKeys = allColumns.map(col => col.key);
    setVisibleColumnKeys(prev => {
      if (!prev.length) {
        return nextKeys;
      }

      const preserved = prev.filter(key => nextKeys.includes(key));
      const missing = nextKeys.filter(key => !preserved.includes(key));

      if (preserved.length === prev.length && missing.length === 0) {
        return prev;
      }

      return [...preserved, ...missing];
    });
  }, [allColumns]);

  const columns = useMemo(
    () => allColumns.filter(col => visibleColumnKeys.includes(col.key)),
    [allColumns, visibleColumnKeys]
  );

  const toggleColumnVisibility = useCallback((key) => {
    setVisibleColumnKeys(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) {
          message.warning('Phải có ít nhất một cột được hiển thị.');
          return prev;
        }
        return prev.filter(k => k !== key);
      }

      const next = [...prev, key];
      const orderedKeys = allColumns
        .map(col => col.key)
        .filter(colKey => next.includes(colKey));
      return orderedKeys;
    });
  }, [allColumns]);

  const columnSelectionContent = useMemo(() => (
    <Space direction="vertical" style={{ minWidth: 200 }}>
      {allColumns.map(col => (
        <Checkbox
          key={col.key}
          checked={visibleColumnKeys.includes(col.key)}
          onChange={() => toggleColumnVisibility(col.key)}
        >
          {typeof col.title === 'string' ? col.title : col.key}
        </Checkbox>
      ))}
    </Space>
  ), [allColumns, toggleColumnVisibility, visibleColumnKeys]);

  return (
    <Card
      title={
        <Space>
          <span>Folder Table View</span>
          {searchResults && (
            <Popover
              placement="bottomRight"
              trigger="click"
              content={columnSelectionContent}
            >
              <Button
                type="text"
                icon={<SettingOutlined />}
              />
            </Popover>
          )}
        </Space>
      }
      extra={
        <Typography.Text type="secondary">
          {searchResults
            ? (focusPaths
              ? `Hiển thị ${dataSource.rows.length} / ${combinedFolders.length} thư mục liên quan`
              : `Tổng số thư mục: ${dataSource.rows.length}`)
            : 'Bảng thư mục sẽ được tải sau khi bạn thực hiện tìm kiếm'}
        </Typography.Text>
      }
    >
      {searchResults ? (
        <Table
          dataSource={dataSource.rows}
          columns={columns}
          pagination={{ pageSize: 50, showSizeChanger: true, defaultPageSize: 50 }}
          rowClassName={(record) => (highlightPaths.has(record.path) ? 'folder-table-highlight' : '')}
          scroll={{ x: true }}
        />
      ) : (
        <Empty description="Hãy thực hiện tìm kiếm để xem dữ liệu thư mục" />
      )}
    </Card>
  );
};

export default FolderTableMode;
