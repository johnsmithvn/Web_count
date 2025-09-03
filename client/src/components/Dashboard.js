import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Spin, Alert } from 'antd';
import { 
  FolderOutlined, 
  FileOutlined, 
  DatabaseOutlined,
  ClockCircleOutlined 
} from '@ant-design/icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ApiService } from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard = ({ refreshTrigger }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
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

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

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
    </div>
  );
};

export default Dashboard;
