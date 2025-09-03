import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Typography, 
  Space,
  Tag,
  Alert
} from 'antd';
import { 
  CopyOutlined,
  ExportOutlined,
  FileOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';

const { Text } = Typography;

const FileMode = ({ searchResults, refreshTrigger }) => {
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const copyPath = (folderPath, fileName) => {
    const fullPath = `${folderPath}${folderPath.endsWith('\\') || folderPath.endsWith('/') ? '' : '\\'}${fileName}`;
    navigator.clipboard.writeText(fullPath).then(() => {
      console.log('Path copied to clipboard');
    });
  };

  const exportFiles = async () => {
    try {
      setLoading(true);
      const blob = await ApiService.exportData('files');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'files.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExtensionColor = (extension) => {
    const colors = {
      '.mp4': 'red',
      '.mp3': 'blue',
      '.jpg': 'green',
      '.png': 'green',
      '.pdf': 'orange',
      '.txt': 'default',
      '.doc': 'purple',
      '.docx': 'purple',
      '.zip': 'gold'
    };
    return colors[extension?.toLowerCase()] || 'default';
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text, record) => (
        <Space>
          <FileOutlined />
          <Text>{text}</Text>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Extension',
      dataIndex: 'extension',
      key: 'extension',
      width: '10%',
      render: (extension) => (
        extension ? (
          <Tag color={getExtensionColor(extension)}>
            {extension.toUpperCase()}
          </Tag>
        ) : (
          <Tag>NO EXT</Tag>
        )
      ),
      filters: searchResults?.files ? 
        [...new Set(searchResults.files.map(f => f.extension).filter(Boolean))]
          .map(ext => ({ text: ext.toUpperCase(), value: ext })) : [],
      onFilter: (value, record) => record.extension === value,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: '12%',
      render: (size) => formatBytes(size || 0),
      sorter: (a, b) => (a.size || 0) - (b.size || 0),
    },
    {
      title: 'Folder Path',
      dataIndex: 'folder_path',
      key: 'folder_path',
      width: '30%',
      render: (path) => (
        <Space>
          <FolderOutlined />
          <Text ellipsis style={{ maxWidth: 200 }} title={path}>
            {path}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Modified',
      dataIndex: 'modified_at',
      key: 'modified_at',
      width: '12%',
      render: formatDate,
      sorter: (a, b) => new Date(a.modified_at || 0) - new Date(b.modified_at || 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '11%',
      render: (_, record) => (
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyPath(record.folder_path, record.name)}
          title="Copy full path"
        >
          Copy
        </Button>
      ),
    },
  ];

  const handleTableChange = (paginationConfig, filters, sorter) => {
    setPagination({
      ...pagination,
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
    });
  };

  useEffect(() => {
    if (searchResults?.files) {
      setPagination(prev => ({
        ...prev,
        total: searchResults.totalFiles || searchResults.files.length
      }));
    }
  }, [searchResults]);

  if (!searchResults) {
    return (
      <Alert
        message="No File Data"
        description="Use the search panel above to find files or run a file scan to populate the database."
        type="info"
        showIcon
      />
    );
  }

  const files = searchResults.files || [];

  return (
    <Card 
      title={`Files (${searchResults.totalFiles || files.length} total)`}
      extra={
        <Space>
          <Button 
            icon={<ExportOutlined />} 
            onClick={exportFiles}
            loading={loading}
          >
            Export CSV
          </Button>
        </Space>
      }
    >
      {files.length > 0 ? (
        <>
          <Table
            columns={columns}
            dataSource={files}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} files`,
              pageSizeOptions: ['25', '50', '100', '200'],
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
            size="small"
          />
          
          {searchResults.pagination && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Text type="secondary">
                Showing page {searchResults.pagination.page} of {searchResults.pagination.totalPages}
              </Text>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
          No files found matching your search criteria.
        </div>
      )}
    </Card>
  );
};

export default FileMode;
