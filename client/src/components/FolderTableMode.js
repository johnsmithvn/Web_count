import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Button,
  Tooltip,
  message,
  Empty,
  Popover,
  Checkbox,
} from 'antd';
import { ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { ApiService } from '../services/api';
import { copyToClipboard } from '../utils/clipboard';

const PAGE_SIZE = 500;

const getFolderLabel = (folder) => {
  if (!folder) return '';
  if (folder.level === 0) {
    return folder.path || folder.name || '';
  }
  if (folder.name) return folder.name;
  if (folder.path) {
    const segments = folder.path.split(/[\\/]+/).filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : folder.path;
  }
  return '';
};

const FolderTableMode = ({ searchResults, refreshTrigger }) => {
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState([]);
  const lastRefreshRef = useRef(refreshTrigger);
  const lastSearchResultRef = useRef(null);

  const fetchAllFolders = useCallback(async () => {
    setLoading(true);
    try {
      const aggregated = [];
      let currentPage = 1;
      let total = Infinity;

      while (aggregated.length < total) {
        const result = await ApiService.search({
          query: '',
          mode: 'contains',
          caseSensitive: 'false',
          searchType: 'folders',
          searchIn: 'both',
          page: currentPage,
          limit: PAGE_SIZE,
        });

        const fetched = Array.isArray(result?.folders) ? result.folders : [];
        aggregated.push(...fetched);
        total = Number.isFinite(result?.totalFolders) ? result.totalFolders : aggregated.length;

        if (fetched.length < PAGE_SIZE) {
          break;
        }

        currentPage += 1;
      }

      setFolders(aggregated);
    } catch (error) {
      console.error('Failed to load folder table data:', error);
      message.error('Không thể tải danh sách thư mục. Vui lòng thử lại.');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchResults) {
      setFolders([]);
      setLoading(false);
      lastSearchResultRef.current = null;
      return;
    }

    if (lastSearchResultRef.current !== searchResults) {
      lastSearchResultRef.current = searchResults;
      fetchAllFolders();
    }
  }, [searchResults, fetchAllFolders]);

  useEffect(() => {
    if (!searchResults) {
      lastRefreshRef.current = refreshTrigger;
      return;
    }

    if (refreshTrigger !== lastRefreshRef.current) {
      lastRefreshRef.current = refreshTrigger;
      fetchAllFolders();
    }
  }, [refreshTrigger, searchResults, fetchAllFolders]);

  const combinedFolders = useMemo(() => {
    const map = new Map((folders || []).map(folder => [folder.path, folder]));
    if (Array.isArray(searchResults?.folders)) {
      searchResults.folders.forEach(folder => {
        if (folder?.path) {
          map.set(folder.path, { ...map.get(folder.path), ...folder });
        }
      });
    }
    return Array.from(map.values());
  }, [folders, searchResults?.folders]);

  const folderMap = useMemo(() => {
    const map = new Map();
    combinedFolders.forEach(folder => {
      if (folder?.path) {
        map.set(folder.path, folder);
      }
    });
    return map;
  }, [combinedFolders]);

  const highlightPaths = useMemo(() => new Set(searchResults?.highlightPaths || []), [searchResults?.highlightPaths]);

  const focusPaths = useMemo(() => {
    if (!searchResults) return null;
    const paths = new Set();

    const addPathChain = (path) => {
      if (!path || paths.has(path)) return;
      paths.add(path);
      const parent = folderMap.get(path)?.parent_path;
      if (parent && !paths.has(parent)) {
        addPathChain(parent);
      }
    };

    (searchResults.folders || []).forEach(folder => {
      if (folder?.path) addPathChain(folder.path);
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
      };

      let current = folder;
      let safety = 0;
      while (current && safety < 200) {
        const levelIndex = Number.isFinite(current.level) ? current.level : 0;
        row[`level_${levelIndex}`] = getFolderLabel(current);
        if (!current.parent_path) break;
        current = folderMap.get(current.parent_path);
        safety += 1;
      }

      // Ensure root column is filled even if traversal failed
      if (!row.level_0 && folder?.path) {
        const rootSegments = folder.path.split(/[\\/]+/).filter(Boolean);
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

  const handleRefresh = () => {
    if (!searchResults) return;
    fetchAllFolders();
  };

  return (
    <Card
      title={
        <Space>
          <span>Folder Table View</span>
          {searchResults && (
            <>
              <Tooltip title="Tải lại dữ liệu thư mục">
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  disabled={loading}
                />
              </Tooltip>
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
            </>
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
          loading={loading}
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
