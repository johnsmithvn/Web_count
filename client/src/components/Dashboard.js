import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Spin, Alert, Table, Modal, Button, Tag, Space, Typography, Empty, message } from 'antd';
import { 
  FolderOutlined, 
  FileOutlined, 
  DatabaseOutlined,
  ClockCircleOutlined 
} from '@ant-design/icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ApiService } from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const { Text, Paragraph } = Typography;

const Dashboard = ({ refreshTrigger }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rootPaths, setRootPaths] = useState([]);
  const [rootPathsLoading, setRootPathsLoading] = useState(true);
  const [rootPathsError, setRootPathsError] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [selectedRootPath, setSelectedRootPath] = useState(null);
  const [rootPathHistory, setRootPathHistory] = useState([]);
  const [rootPathTotals, setRootPathTotals] = useState(null);
  const [rootPathCurrentData, setRootPathCurrentData] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingRootPath, setDeletingRootPath] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchRootPaths();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRootPaths = async () => {
    setRootPathsLoading(true);
    setRootPathsError(null);
    try {
      const data = await ApiService.getRootPaths();
      setRootPaths(data.rootPaths || []);
    } catch (err) {
      setRootPathsError(err.message);
      setRootPaths([]);
    } finally {
      setRootPathsLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const renderStatusTag = (status) => {
    if (!status) {
      return <Tag>UNKNOWN</Tag>;
    }

    const normalizedStatus = status.toLowerCase();
    const colorMap = {
      completed: 'green',
      running: 'blue',
      pending: 'gold',
      failed: 'red',
      error: 'red'
    };

    return <Tag color={colorMap[normalizedStatus] || 'default'}>{normalizedStatus.toUpperCase()}</Tag>;
  };

  const openRootPathDetails = async (record) => {
    setSelectedRootPath(record);
    setDetailsVisible(true);
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const data = await ApiService.getRootPathDetails(record.rootPath);
      setRootPathHistory(data.scans || []);
      setRootPathTotals(data.totals || null);
      setRootPathCurrentData(data.currentData || null);
    } catch (err) {
      setDetailsError(err.message);
      setRootPathHistory([]);
      setRootPathTotals(null);
      setRootPathCurrentData(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetailsModal = () => {
    setDetailsVisible(false);
    setSelectedRootPath(null);
    setRootPathHistory([]);
    setRootPathTotals(null);
    setRootPathCurrentData(null);
    setDetailsError(null);
  };

  const handleDeleteRootPath = async () => {
    if (!selectedRootPath) return;

    const pathToDelete = selectedRootPath.rootPath;
    setDeletingRootPath(true);

    try {
      await ApiService.deleteByPath(pathToDelete, 'both');
      message.success(`Đã xóa dữ liệu cho ${pathToDelete}`);
      setDeleteConfirmVisible(false);
      closeDetailsModal();
      setRootPaths((prev) => prev.filter((item) => item.rootPath !== pathToDelete));
      fetchStats();
      fetchRootPaths();
    } catch (err) {
      message.error(err.message || 'Không thể xóa đường dẫn này');
    } finally {
      setDeletingRootPath(false);
    }
  };

  const renderScanOptions = (options) => {
    if (!options || (typeof options === 'object' && Object.keys(options).length === 0)) {
      return '-';
    }

    const content = typeof options === 'string' ? options : JSON.stringify(options);
    return <Text code style={{ whiteSpace: 'pre-wrap' }}>{content}</Text>;
  };

  const rootPathColumns = [
    {
      title: 'Đường dẫn gốc',
      dataIndex: 'rootPath',
      key: 'rootPath',
      ellipsis: true,
      render: (value) => <Text strong>{value}</Text>
    },
    {
      title: 'Ngày quét gần nhất',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => formatDate(value)
    },
    {
      title: 'Hoàn thành',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (value) => formatDate(value)
    },
    {
      title: 'Thư mục',
      dataIndex: 'foldersCount',
      key: 'foldersCount',
      align: 'right'
    },
    {
      title: 'Tệp',
      dataIndex: 'filesCount',
      key: 'filesCount',
      align: 'right'
    },
    {
      title: 'Số lần quét',
      dataIndex: 'scanCount',
      key: 'scanCount',
      align: 'right'
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => renderStatusTag(status)
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" onClick={() => openRootPathDetails(record)}>
          Xem chi tiết
        </Button>
      )
    }
  ];

  const historyColumns = [
    {
      title: 'Thời gian bắt đầu',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => formatDate(value)
    },
    {
      title: 'Hoàn thành',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (value) => formatDate(value)
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => renderStatusTag(status)
    },
    {
      title: 'Thư mục',
      dataIndex: 'foldersCount',
      key: 'foldersCount',
      align: 'right'
    },
    {
      title: 'Tệp',
      dataIndex: 'filesCount',
      key: 'filesCount',
      align: 'right'
    },
    {
      title: 'Tùy chọn',
      dataIndex: 'scanOptions',
      key: 'scanOptions',
      render: (value) => renderScanOptions(value)
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Statistics"
        description={error}
        type="error"
        showIcon
        action={
          <button onClick={fetchStats} style={{ 
            background: 'none', 
            border: 'none', 
            color: '#1890ff', 
            cursor: 'pointer' 
          }}>
            Retry
          </button>
        }
      />
    );
  }

  if (!stats) {
    return (
      <Alert
        message="No Data Available"
        description="Run a scan to populate the database and see statistics."
        type="info"
        showIcon
      />
    );
  }

  // Prepare chart data
  const fileTypeData = stats.fileTypes?.slice(0, 10).map(item => ({
    name: item.extension || 'No extension',
    value: item.count,
    size: item.total_size
  })) || [];

  const sizeDistributionData = stats.sizeDistribution?.map(item => ({
    name: item.size_range,
    count: item.count,
    size: item.total_size
  })) || [];

  return (
    <div>
      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Folders"
              value={stats.summary?.totalFolders || 0}
              prefix={<FolderOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Files"
              value={stats.summary?.totalFiles || 0}
              prefix={<FileOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Size"
              value={formatBytes(stats.summary?.totalSize || 0)}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Last Scan"
              value={formatDate(stats.summary?.lastFileScan || stats.summary?.lastFolderScan)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* File Types Chart */}
        <Col span={12}>
          <Card title="File Types Distribution" style={{ height: 400 }}>
            {fileTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={fileTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fileTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, 'Files']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                No file data available
              </div>
            )}
          </Card>
        </Col>

        {/* Size Distribution Chart */}
        <Col span={12}>
          <Card title="File Size Distribution" style={{ height: 400 }}>
            {sizeDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sizeDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [value, 'Files']} />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                No size data available
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Additional Stats */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="Largest Files" size="small">
            {stats.largestFiles?.length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {stats.largestFiles.map((file, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '4px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <span style={{ fontSize: '12px', flex: 1 }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      {formatBytes(file.size)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#999' }}>
                No file data available
              </div>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Busiest Folders" size="small">
            {stats.busiestFolders?.length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {stats.busiestFolders.map((folder, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '4px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <span style={{ fontSize: '12px', flex: 1 }}>
                      {folder.name || folder.path}
                    </span>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      {folder.file_count} files
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#999' }}>
                No folder data available
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Danh sách đường dẫn đã quét" style={{ marginTop: 24 }}>
        {rootPathsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
          </div>
        ) : rootPathsError ? (
          <Alert
            type="error"
            message="Không thể tải danh sách đường dẫn"
            description={rootPathsError}
            showIcon
            action={
              <Button type="link" onClick={fetchRootPaths}>
                Thử lại
              </Button>
            }
          />
        ) : rootPaths.length === 0 ? (
          <Empty description="Chưa có đường dẫn nào được quét" />
        ) : (
          <Table
            dataSource={rootPaths}
            columns={rootPathColumns}
            rowKey={(record) => record.rootPath}
            pagination={{ pageSize: 5, hideOnSinglePage: true }}
          />
        )}
      </Card>

      <Modal
        open={detailsVisible}
        onCancel={closeDetailsModal}
        title={selectedRootPath ? `Chi tiết quét: ${selectedRootPath.rootPath}` : 'Chi tiết quét'}
        width={900}
        footer={[
          <Button key="cancel" onClick={closeDetailsModal}>
            Đóng
          </Button>,
          <Button
            key="delete"
            danger
            onClick={() => setDeleteConfirmVisible(true)}
            disabled={!selectedRootPath}
          >
            Xóa đường dẫn
          </Button>
        ]}
      >
        {detailsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
          </div>
        ) : detailsError ? (
          <Alert
            type="error"
            message="Không thể tải chi tiết"
            description={detailsError}
            showIcon
            action={
              <Button type="link" onClick={() => selectedRootPath && openRootPathDetails(selectedRootPath)}>
                Thử lại
              </Button>
            }
          />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Tổng số lần quét" value={rootPathTotals?.scanCount || 0} />
              </Col>
              <Col span={6}>
                <Statistic title="Thư mục đang lưu" value={rootPathCurrentData?.folderCount || 0} />
              </Col>
              <Col span={6}>
                <Statistic title="Tệp đang lưu" value={rootPathCurrentData?.fileCount || 0} />
              </Col>
              <Col span={6}>
                <Statistic title="Dung lượng hiện tại" value={formatBytes(rootPathCurrentData?.totalSize || 0)} />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="Lần quét gần nhất" value={formatDate(rootPathTotals?.latestScan)} />
              </Col>
              <Col span={12}>
                <Statistic title="Hoàn thành" value={formatDate(rootPathTotals?.latestCompletion)} />
              </Col>
            </Row>
            {rootPathHistory.length > 0 ? (
              <Table
                dataSource={rootPathHistory}
                columns={historyColumns}
                rowKey={(record) => record.id}
                size="small"
                pagination={{ pageSize: 6, hideOnSinglePage: true }}
              />
            ) : (
              <Empty description="Chưa có lịch sử quét" />
            )}
          </Space>
        )}
      </Modal>

      <Modal
        open={deleteConfirmVisible}
        title="Xóa dữ liệu"
        onCancel={() => setDeleteConfirmVisible(false)}
        onOk={handleDeleteRootPath}
        okText="Xóa dữ liệu"
        okButtonProps={{ danger: true, loading: deletingRootPath }}
      >
        <Alert
          type="error"
          showIcon
          message="Cảnh báo"
          description="Hành động này sẽ xóa vĩnh viễn dữ liệu khỏi database. Không thể hoàn tác!"
        />
        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
          <div>
            <Text strong>Đường dẫn gốc cần xóa:</Text>
            <Paragraph
              style={{ marginBottom: 0 }}
              copyable={selectedRootPath ? { text: selectedRootPath.rootPath } : undefined}
            >
              {selectedRootPath?.rootPath}
            </Paragraph>
          </div>
          <div>
            <Text strong>Loại xóa:</Text>
            <Paragraph style={{ marginBottom: 0 }}>Xóa thư mục và file liên quan</Paragraph>
          </div>
          <div>
            <Text strong>Thư mục hiện có:</Text> <Text>{rootPathCurrentData?.folderCount || 0}</Text>
            <br />
            <Text strong>Tệp hiện có:</Text> <Text>{rootPathCurrentData?.fileCount || 0}</Text>
            <br />
            <Text strong>Dung lượng lưu trữ:</Text> <Text>{formatBytes(rootPathCurrentData?.totalSize || 0)}</Text>
          </div>
          <Paragraph>
            <Text strong>Ví dụ:</Text>
            <br />
            <Text code>E:\\New folder (4)</Text> - Xóa tất cả dữ liệu đường dẫn này
            <br />
            <Text code>D:\\Media\\Music</Text> - Xóa toàn bộ các folder/file nhạc
            <br />
            <Text code>C:\\Users\\Documents</Text> - Xóa dữ liệu thư mục tài liệu
          </Paragraph>
        </Space>
      </Modal>
    </div>
  );
};

export default Dashboard;
