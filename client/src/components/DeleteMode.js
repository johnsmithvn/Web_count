import React, { useState } from 'react';
import { 
  Card, 
  Input, 
  Button, 
  Radio, 
  Table, 
  Typography, 
  Space,
  Modal,
  Alert,
  message,
  Tag
} from 'antd';
import { 
  DeleteOutlined,
  SearchOutlined,
  FileOutlined,
  FolderOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';

const { Text } = Typography;
const { confirm } = Modal;

const DeleteMode = ({ refreshTrigger, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [matchMode, setMatchMode] = useState('contains'); // 'contains' or 'exact'
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const searchFiles = async () => {
    if (!searchTerm.trim()) {
      message.warning('Please enter a search term');
      return;
    }

    setLoading(true);
    try {
      // Search using existing API with appropriate parameters
      const searchParams = {
        query: searchTerm,
        searchIn: 'name', // Search only in name
        includeFiles: true,
        includeFolders: false
      };

      const results = await ApiService.search(searchParams);
      
      // Filter results based on match mode
      let filteredFiles = results.files || [];
      
      if (matchMode === 'exact') {
        filteredFiles = filteredFiles.filter(file => 
          file.name.toLowerCase() === searchTerm.toLowerCase()
        );
      } else {
        filteredFiles = filteredFiles.filter(file => 
          file.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setSearchResults(filteredFiles);
      
      if (filteredFiles.length === 0) {
        message.info(`No files found ${matchMode === 'exact' ? 'matching exactly' : 'containing'} "${searchTerm}"`);
      } else {
        message.success(`Found ${filteredFiles.length} file(s) ${matchMode === 'exact' ? 'matching exactly' : 'containing'} "${searchTerm}"`);
      }
    } catch (error) {
      console.error('Search error:', error);
      message.error('Search failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const deleteFiles = async () => {
    if (searchResults.length === 0) {
      message.warning('No files to delete');
      return;
    }

    const fileNames = searchResults.map(file => file.name);
    const totalSize = searchResults.reduce((sum, file) => sum + (file.size || 0), 0);

    confirm({
      title: 'Confirm Delete Files',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Alert
            message="Warning: This action cannot be undone!"
            description={`You are about to delete ${searchResults.length} file(s) with total size ${formatBytes(totalSize)}`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div>
            <strong>Files to be deleted:</strong>
            <ul style={{ maxHeight: 200, overflow: 'auto', margin: '8px 0' }}>
              {fileNames.slice(0, 10).map((name, index) => (
                <li key={index}>{name}</li>
              ))}
              {fileNames.length > 10 && (
                <li>... and {fileNames.length - 10} more files</li>
              )}
            </ul>
          </div>
        </div>
      ),
      okText: 'Delete Files',
      okType: 'danger',
      cancelText: 'Cancel',
      width: 600,
      onOk: async () => {
        setDeleting(true);
        try {
          // Delete files by their IDs
          const fileIds = searchResults.map(file => file.id);
          
          for (const fileId of fileIds) {
            await ApiService.deleteFile(fileId);
          }
          
          message.success(`Successfully deleted ${searchResults.length} file(s)`);
          setSearchResults([]);
          setSearchTerm('');
          
          // Trigger refresh in parent components
          if (onRefresh) {
            onRefresh();
          }
        } catch (error) {
          console.error('Delete error:', error);
          message.error('Delete failed: ' + (error.message || 'Unknown error'));
        } finally {
          setDeleting(false);
        }
      }
    });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: '35%',
      render: (text) => (
        <Space>
          <FileOutlined />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Folder Path',
      dataIndex: 'folder_path',
      key: 'folder_path',
      width: '40%',
      render: (path) => (
        <Space>
          <FolderOutlined />
          <Text ellipsis style={{ maxWidth: 400 }} title={path}>
            {path}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Ext',
      dataIndex: 'extension',
      key: 'extension',
      width: '8%',
      render: (extension) => (
        extension ? (
          <Tag color={getExtensionColor(extension)}>
            {extension.replace('.', '').toUpperCase()}
          </Tag>
        ) : (
          <Tag>-</Tag>
        )
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: '10%',
      render: (size) => formatBytes(size || 0),
    },
    {
      title: 'Modified',
      dataIndex: 'modified_at',
      key: 'modified_at',
      width: '12%',
      render: formatDate,
    }
  ];

  return (
    <Card title="Delete Files">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Search Controls */}
        <Card size="small" title="Search & Delete Controls">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>Match Mode:</Text>
              <Radio.Group 
                value={matchMode} 
                onChange={(e) => setMatchMode(e.target.value)}
                style={{ marginLeft: 16 }}
              >
                <Radio value="contains">Contains (chứa text)</Radio>
                <Radio value="exact">Exact Match (khớp chính xác)</Radio>
              </Radio.Group>
            </div>
            
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder={`Enter filename to search ${matchMode === 'exact' ? '(exact match)' : '(contains)'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onPressEnter={searchFiles}
                style={{ flex: 1 }}
              />
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={searchFiles}
                loading={loading}
              >
                Search
              </Button>
            </Space.Compact>

            {searchResults.length > 0 && (
              <Alert
                message={`Found ${searchResults.length} file(s) to delete`}
                description={`Total size: ${formatBytes(searchResults.reduce((sum, file) => sum + (file.size || 0), 0))}`}
                type="warning"
                showIcon
                action={
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={deleteFiles}
                    loading={deleting}
                  >
                    Delete All ({searchResults.length})
                  </Button>
                }
              />
            )}
          </Space>
        </Card>

        {/* Results Table */}
        {searchResults.length > 0 && (
          <Card title={`Files to Delete (${searchResults.length})`}>
            <Table
              columns={columns}
              dataSource={searchResults}
              rowKey="id"
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} files`,
              }}
              scroll={{ x: 1000 }}
              size="small"
            />
          </Card>
        )}

        {searchTerm && searchResults.length === 0 && !loading && (
          <Alert
            message="No Files Found"
            description={`No files ${matchMode === 'exact' ? 'exactly match' : 'contain'} "${searchTerm}" in their name.`}
            type="info"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

export default DeleteMode;
