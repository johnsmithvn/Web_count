import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import {
  DeleteOutlined,
  LockOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import moment from 'moment';

import { ApiService } from '../services/api';

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) {
    return <Text type="secondary">Never</Text>;
  }
  return moment(value).format('YYYY-MM-DD HH:mm');
};

const numberRenderer = (value) => (value ?? 0).toLocaleString();

const AdminUserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getAdminUsers();
      setUsers(response?.users || []);
    } catch (error) {
      console.error('Failed to load admin users', error);
      message.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.totalScans += user.scanCount || 0;
        acc.totalData += user.dataCount || 0;
        return acc;
      },
      { totalScans: 0, totalData: 0 }
    );
  }, [users]);

  const openPasswordModal = (user) => {
    setSelectedUser(user);
    setPasswordModalVisible(true);
    form.resetFields();
  };

  const handlePasswordUpdate = async () => {
    try {
      const values = await form.validateFields();
      setPasswordLoading(true);
      await ApiService.updateUserPassword(selectedUser.id, values.newPassword);
      message.success('Password updated successfully');
      setPasswordModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      console.error('Failed to update password', error);
      message.error(error.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    try {
      setDeletingUserId(user.id);
      await ApiService.deleteUser(user.id);
      message.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user', error);
      message.error(error.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (value, record) => (
        <Space>
          <Text strong>{value}</Text>
          {record.isAdmin && <Tag color="gold">Admin</Tag>}
          {record.id === currentUser?.id && <Tag color="blue">You</Tag>}
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (value) => value || <Text type="secondary">Not set</Text>,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDateTime,
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: formatDateTime,
    },
    {
      title: 'Total Scans',
      dataIndex: 'scanCount',
      key: 'scanCount',
      render: numberRenderer,
      sorter: (a, b) => (a.scanCount || 0) - (b.scanCount || 0),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Total Data',
      dataIndex: 'dataCount',
      key: 'dataCount',
      render: numberRenderer,
      sorter: (a, b) => (a.dataCount || 0) - (b.dataCount || 0),
    },
    {
      title: 'Folders',
      dataIndex: 'folderCount',
      key: 'folderCount',
      render: numberRenderer,
      responsive: ['lg'],
    },
    {
      title: 'Files',
      dataIndex: 'fileCount',
      key: 'fileCount',
      render: numberRenderer,
      responsive: ['lg'],
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const isCurrentUser = record.id === currentUser?.id;

        return (
          <Space>
            <Button
              type="link"
              icon={<LockOutlined />}
              onClick={() => openPasswordModal(record)}
            >
              Reset Password
            </Button>
            <Popconfirm
              title="Delete account"
              description={`Are you sure you want to delete ${record.username}? This will remove all of their data.`}
              onConfirm={() => handleDeleteUser(record)}
              okButtonProps={{ danger: true }}
              okText="Delete"
              cancelText="Cancel"
              disabled={isCurrentUser}
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                disabled={isCurrentUser}
                loading={deletingUserId === record.id}
              >
                Delete
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="Accounts overview"
        extra={(
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchUsers}
            loading={loading}
          >
            Refresh
          </Button>
        )}
      >
        <Space size="large">
          <Text strong>Total accounts:</Text>
          <Text>{users.length}</Text>
          <Text strong>Total scans:</Text>
          <Text>{totals.totalScans.toLocaleString()}</Text>
          <Text strong>Total data entries:</Text>
          <Text>{totals.totalData.toLocaleString()}</Text>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={users}
          columns={columns}
          pagination={{ pageSize: 8, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={selectedUser ? `Reset password for ${selectedUser.username}` : 'Reset password'}
        open={passwordModalVisible}
        onOk={handlePasswordUpdate}
        confirmLoading={passwordLoading}
        onCancel={() => setPasswordModalVisible(false)}
        okText="Update password"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="New password"
            name="newPassword"
            rules={[
              { required: true, message: 'Please enter a new password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm the new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              })
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AdminUserManagement;

