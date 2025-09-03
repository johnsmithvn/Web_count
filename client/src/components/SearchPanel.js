import React, { useState } from 'react';
import { 
  Card, 
  Input, 
  Button, 
  Select, 
  Row, 
  Col, 
  Form,
  Switch,
  InputNumber,
  DatePicker,
  Modal,
  Space,
  message
} from 'antd';
import { 
  SearchOutlined, 
  FolderOutlined, 
  FileOutlined, 
  ClearOutlined,
  ScanOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const SearchPanel = ({ onSearch, onScan, onClearSearch, loading, hasResults }) => {
  const [searchForm] = Form.useForm();
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingDeleteData, setPendingDeleteData] = useState(null);
  const [scanForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [settingsForm] = Form.useForm();

  const handleSearch = async () => {
    try {
      setSearchLoading(true);
      const searchValues = await searchForm.validateFields(['query']);
      
      // Get settings values, use getFieldsValue if form is not mounted
      let settingsValues = {};
      try {
        settingsValues = settingsForm.getFieldsValue();
      } catch {
        // Use default values if settings form is not available
        settingsValues = {};
      }
      
      const searchParams = {
        query: searchValues.query || '',
        mode: settingsValues.mode || 'fuzzy',
        caseSensitive: settingsValues.caseSensitive ? 'true' : 'false',
        searchType: settingsValues.searchType || 'both',
        searchIn: settingsValues.searchIn || 'both',
        extension: settingsValues.extension || '',
        sizeMin: settingsValues.sizeRange?.[0] || '',
        sizeMax: settingsValues.sizeRange?.[1] || '',
        dateFrom: settingsValues.dateRange?.[0]?.format('YYYY-MM-DD') || '',
        dateTo: settingsValues.dateRange?.[1]?.format('YYYY-MM-DD') || '',
        page: 1,
        limit: 100
      };
      
      await onSearch(searchParams);
      message.success(`Search completed! Found ${searchParams.query ? `results for "${searchParams.query}"` : 'all items'}`);
    } catch (error) {
      message.error('Search failed: ' + (error.message || 'Please check your search criteria'));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleScan = async (values) => {
    try {
      setScanLoading(true);
      const scanParams = {
        rootPath: values.rootPath,
        maxDepth: values.maxDepth || 10,
        includeExtensions: values.includeExtensions || []
      };

      const result = await onScan(values.scanType, scanParams);
      setScanModalVisible(false);
      scanForm.resetFields();
      message.success(result?.message || `${values.scanType} scan completed successfully!`);
    } catch (error) {
      message.error('Scan failed: ' + (error.message || 'Please check your scan settings'));
    } finally {
      setScanLoading(false);
    }
  };

  const showScanModal = () => {
    setScanModalVisible(true);
  };

  const handleDelete = async (values) => {
    try {
      setDeleteLoading(true);
      
      const result = await ApiService.deleteByPath(values.rootPath, values.deleteType);
      
      message.success(`${result.message || 'Xóa thành công'}. Đã xóa ${result.deletedFolders || 0} thư mục và ${result.deletedFiles || 0} file.`);
      setDeleteModalVisible(false);
      deleteForm.resetFields();
      
      // Trigger refresh in parent component
      if (onClearSearch) onClearSearch();
    } catch (error) {
      message.error('Xóa thất bại: ' + error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const showDeleteModal = () => {
    setDeleteModalVisible(true);
  };

  const handlePreviewDelete = async () => {
    try {
      const values = await deleteForm.validateFields(['rootPath', 'deleteType']);
      
      // Normalize path
      const normalizedPath = values.rootPath.trim().replace(/\\/g, '\\');
      
      // Store data and show custom confirmation modal
      setPendingDeleteData({ ...values, rootPath: normalizedPath });
      setDeleteConfirmVisible(true);
      
    } catch (error) {
      message.error('Validation failed: ' + error.message);
    }
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteData) {
      setDeleteConfirmVisible(false);
      setDeleteModalVisible(false);
      handleDelete(pendingDeleteData);
    }
  };

  const handleCancelConfirm = () => {
    setDeleteConfirmVisible(false);
    setPendingDeleteData(null);
  };

  return (
    <>
      <Card title="Search & Scan Controls" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Form form={searchForm} style={{ marginBottom: 0 }}>
              <Form.Item name="query" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="Enter search term..."
                  suffix={<SearchOutlined />}
                  onPressEnter={handleSearch}
                  size="large"
                />
              </Form.Item>
            </Form>
          </Col>
          
          <Col span={12}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={searchLoading || loading}
                size="large"
              >
                Search
              </Button>
              
              <Button 
                icon={<SettingOutlined />}
                onClick={() => setSettingsModalVisible(true)}
                title="Search Settings"
              >
                Settings
              </Button>
              
              {hasResults && (
                <Button 
                  icon={<ClearOutlined />}
                  onClick={onClearSearch}
                >
                  Clear Results
                </Button>
              )}
              
              <Button 
                type="dashed"
                icon={<ScanOutlined />}
                onClick={showScanModal}
              >
                Scan Folders
              </Button>
              
              <Button 
                type="dashed"
                danger
                icon={<DeleteOutlined />}
                onClick={showDeleteModal}
              >
                Delete Data
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Search Settings Modal */}
      <Modal
        title="Search Settings"
        open={settingsModalVisible}
        onOk={() => setSettingsModalVisible(false)}
        onCancel={() => setSettingsModalVisible(false)}
        width={800}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          initialValues={{
            mode: 'fuzzy',
            searchType: 'both',
            searchIn: 'both',
            caseSensitive: false
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Search Mode"
                name="mode"
              >
                <Select>
                  <Option value="exact">Exact Match</Option>
                  <Option value="fuzzy">Fuzzy Search</Option>
                  <Option value="regex">Regex</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Search In"
                name="searchIn"
              >
                <Select>
                  <Option value="both">Name & Path</Option>
                  <Option value="name">Name Only</Option>
                  <Option value="path">Path Only</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Search Type"
                name="searchType"
              >
                <Select>
                  <Option value="both">Both</Option>
                  <Option value="folders">Folders Only</Option>
                  <Option value="files">Files Only</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Extension"
                name="extension"
              >
                <Input placeholder=".mp4, .jpg..." />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Case Sensitive"
                name="caseSensitive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Size Range (bytes)"
                name="sizeRange"
              >
                <Space.Compact>
                  <InputNumber
                    style={{ width: '50%' }}
                    placeholder="Min"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                  <InputNumber
                    style={{ width: '50%' }}
                    placeholder="Max"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Space.Compact>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Date Range"
                name="dateRange"
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Scan Configuration"
        open={scanModalVisible}
        onOk={() => scanForm.submit()}
        onCancel={() => setScanModalVisible(false)}
        confirmLoading={scanLoading || loading}
        width={600}
      >
        <Form
          form={scanForm}
          layout="vertical"
          onFinish={handleScan}
          initialValues={{
            scanType: 'folder',
            maxDepth: 10
          }}
        >
          <Form.Item
            label="Scan Type"
            name="scanType"
            rules={[{ required: true, message: 'Please select scan type' }]}
          >
            <Select>
              <Option value="folder">
                <FolderOutlined /> Folder Only (Structure)
              </Option>
              <Option value="file">
                <FileOutlined /> File Detail (With Metadata)
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Root Path"
            name="rootPath"
            rules={[{ required: true, message: 'Please enter root path' }]}
          >
            <Input 
              placeholder="C:\Users\YourName\Documents" 
              addonBefore={<FolderOutlined />}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Max Depth"
                name="maxDepth"
                tooltip="Maximum folder depth to scan (0 = unlimited)"
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Include Extensions (file mode only)"
                name="includeExtensions"
                tooltip="Leave empty to include all files"
              >
                <Select
                  mode="tags"
                  placeholder="e.g., .mp4, .jpg, .pdf"
                  style={{ width: '100%' }}
                >
                  <Option value=".mp4">.mp4</Option>
                  <Option value=".mp3">.mp3</Option>
                  <Option value=".jpg">.jpg</Option>
                  <Option value=".png">.png</Option>
                  <Option value=".pdf">.pdf</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Delete Data"
        open={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        confirmLoading={deleteLoading}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => setDeleteModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="delete" 
            type="primary" 
            danger
            onClick={handlePreviewDelete}
            loading={deleteLoading}
          >
            Xóa dữ liệu
          </Button>
        ]}
      >
        <Form
          form={deleteForm}
          layout="vertical"
          onFinish={handleDelete}
          initialValues={{
            deleteType: 'both'
          }}
        >
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 6 }}>
            <ExclamationCircleOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
            <strong>Cảnh báo:</strong> Hành động này sẽ xóa vĩnh viễn dữ liệu khỏi database. Không thể hoàn tác!
          </div>

          <Form.Item
            label="Đường dẫn gốc cần xóa"
            name="rootPath"
            rules={[{ required: true, message: 'Vui lòng nhập đường dẫn gốc' }]}
            tooltip="Tất cả dữ liệu khớp với đường dẫn này sẽ bị xóa. VD: E:\New folder (4)"
          >
            <Input 
              placeholder="E:\New folder (4)\New folder (2)" 
              addonBefore={<DeleteOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="Loại xóa"
            name="deleteType"
            rules={[{ required: true, message: 'Vui lòng chọn loại xóa' }]}
          >
            <Select>
              <Option value="both">
                <DeleteOutlined /> Cả thư mục và file
              </Option>
              <Option value="folders">
                <FolderOutlined /> Chỉ thư mục
              </Option>
              <Option value="files">
                <FileOutlined /> Chỉ file
              </Option>
            </Select>
          </Form.Item>

          <div style={{ 
            padding: 12, 
            backgroundColor: '#f6ffed', 
            border: '1px solid #b7eb8f', 
            borderRadius: 6,
            fontSize: '14px'
          }}>
            <strong>Ví dụ:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li><code>E:\New folder (4)</code> - Xóa tất cả dưới đường dẫn này</li>
              <li><code>D:\Media\Music</code> - Xóa tất cả folder/file nhạc</li>
              <li><code>C:\Users\Documents</code> - Xóa tất cả dữ liệu tài liệu</li>
            </ul>
          </div>
        </Form>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal
        title="Xác nhận xóa dữ liệu"
        open={deleteConfirmVisible}
        onCancel={handleCancelConfirm}
        width={500}
        footer={[
          <Button key="cancel" onClick={handleCancelConfirm}>
            Hủy
          </Button>,
          <Button 
            key="confirm" 
            type="primary" 
            danger
            loading={deleteLoading}
            onClick={handleConfirmDelete}
          >
            Xóa ngay
          </Button>
        ]}
      >
        {pendingDeleteData && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 6 }}>
              <ExclamationCircleOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
              <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác!
            </div>
            
            <p><strong>Đường dẫn gốc:</strong> {pendingDeleteData.rootPath}</p>
            <p><strong>Loại xóa:</strong> {
              pendingDeleteData.deleteType === 'both' ? 'Cả thư mục và file' :
              pendingDeleteData.deleteType === 'folders' ? 'Chỉ thư mục' :
              pendingDeleteData.deleteType === 'files' ? 'Chỉ file' : pendingDeleteData.deleteType
            }</p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default SearchPanel;
