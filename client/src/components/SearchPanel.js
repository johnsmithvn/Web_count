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
  
  // Persistent search settings state
  const [searchSettings, setSearchSettings] = useState({
    mode: 'fuzzy',
    searchType: 'both',
    searchIn: 'both',
    caseSensitive: false,
    extension: '',
    sizeRange: undefined,
  dateRange: undefined,
  ancestorLevels: 0,
  ancestorMode: 'from-root'
  });
  
  // Create form instances - warnings will be suppressed by destroyOnClose
  const [scanForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  // Watchers to force re-render when include/exclude lists change (keeps counts fresh)
  const includeExtValues = Form.useWatch('includeExtensions', scanForm) || [];
  const excludeExtValues = Form.useWatch('excludeExtensions', scanForm) || [];

  // --- Extension groups for quick select/clear ---
  const INCLUDE_GROUPS = {
    '🎬 Video Files': ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts', '.vob', '.rmvb', '.asf'],
    '🎵 Audio Files': ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff', '.opus', '.ac3', '.dts'],
    '🖼️ Image Files': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tga', '.ico', '.svg', '.psd', '.raw', '.cr2', '.nef', '.arw'],
    '📄 Documents': ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf'],
    '📦 Archives': ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'],
    '💻 Code Files': ['.js', '.css', '.html', '.json', '.xml', '.py', '.java', '.cpp', '.cs', '.php']
  };

  const EXCLUDE_GROUPS = {
    '🗑️ Temporary Files': ['.tmp', '.temp', '.cache', '.bak', '.old', '.~', '.$$$', '.backup', '.orig', '.part', '.crdownload'],
    '📝 Log/System Files': ['.log', '.swp', '.swo', '.ds_store', '.thumbs.db', '.desktop.ini', '.ini', '.db', '.lock'],
    '🖥️ Windows System': ['.sys', '.dll', '.lnk', '.exe', '.msi'],
    '💻 Development': ['.git', '.gitignore', '.node_modules', '.env', '.o', '.obj'],
    '🌐 Web/Shortcuts': ['.torrent', '.url', '.webloc']
  };

  const normalizeExtensions = (values = []) => {
    const norm = (v) => {
      if (!v && v !== 0) return '';
      let s = String(v).trim().toLowerCase();
      // convert comma-separated into separate tags if user pasted many
      // This function is used per item; bulk paste handled below.
      if (!s.startsWith('.')) s = `.${s}`;
      return s;
    };
    // Flatten any comma-separated pastes (e.g., ".mp4, .mkv")
    const expanded = values.flatMap((v) =>
      String(v)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    );
    return Array.from(new Set(expanded.map(norm)));
  };

  const applyGroup = (field, groupList) => {
    const current = normalizeExtensions(scanForm.getFieldValue(field) || []);
    const next = Array.from(new Set([...current, ...groupList]));
    scanForm.setFieldsValue({ [field]: next });
  };

  const clearGroup = (field, groupList) => {
    const current = normalizeExtensions(scanForm.getFieldValue(field) || []);
    const next = current.filter((x) => !new Set(groupList).has(x));
    scanForm.setFieldsValue({ [field]: next });
  };

  const groupSelectedCount = (currentValues, groupList) => {
    const current = normalizeExtensions(currentValues || []);
    return current.filter((x) => new Set(groupList).has(x)).length;
  };

  // Clickable label used inside Select.OptGroup to toggle select/clear all for a group
  const renderGroupLabel = (field, label, list) => {
    const currentValues = field === 'includeExtensions' ? includeExtValues : excludeExtValues;
    const count = groupSelectedCount(currentValues, list);
    const allSelected = list.length > 0 && count === list.length;
    return (
      <div
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          if (allSelected) {
            clearGroup(field, list);
          } else {
            applyGroup(field, list);
          }
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
        title={allSelected ? 'Bấm để xóa tất cả trong nhóm' : 'Bấm để chọn tất cả trong nhóm'}
      >
        <span>{label}</span>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{count}/{list.length}</span>
      </div>
    );
  };

  const handleSearch = async () => {
    try {
      setSearchLoading(true);
      // Ensure previous results are cleared before a new search
      if (typeof onClearSearch === 'function') {
        onClearSearch();
      }
      const searchValues = await searchForm.validateFields(['query']);
      
      const searchParams = {
        query: searchValues.query || '',
        mode: searchSettings.mode || 'fuzzy',
        caseSensitive: searchSettings.caseSensitive ? 'true' : 'false',
        searchType: searchSettings.searchType || 'both',
        searchIn: searchSettings.searchIn || 'both',
        extension: searchSettings.extension || '',
        sizeMin: searchSettings.sizeRange?.[0] || '',
        sizeMax: searchSettings.sizeRange?.[1] || '',
        dateFrom: searchSettings.dateRange?.[0]?.format('YYYY-MM-DD') || '',
        dateTo: searchSettings.dateRange?.[1]?.format('YYYY-MM-DD') || '',
  ancestorLevels: Number.isFinite(Number(searchSettings.ancestorLevels)) ? Number(searchSettings.ancestorLevels) : 0,
  ancestorMode: searchSettings.ancestorMode || 'from-root',
        page: 1,
        limit: 100
      };
      
      console.log('Search params being sent:', searchParams); // Debug log
      
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
        includeExtensions: values.includeExtensions || [],
        excludeExtensions: values.excludeExtensions || []
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

  const handleSaveSettings = async () => {
    try {
      const values = await settingsForm.validateFields();
      setSearchSettings(values);
      setSettingsModalVisible(false);
      message.success('Search settings saved successfully!');
    } catch (error) {
      message.error('Failed to save settings: ' + (error.message || 'Please check your settings'));
    }
  };

  return (
    <>
      <Card title="Search & Scan Controls" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Form form={searchForm} style={{ marginBottom: 0 }}>
              <Form.Item name="query" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="Search files and folders... (Try: 'star wars' or 'final fantasy')"
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
        onOk={handleSaveSettings}
        onCancel={() => setSettingsModalVisible(false)}
        width={800}
        okText="Save Settings"
        cancelText="Cancel"
      >
        <Form
          form={settingsForm}
          layout="vertical"
          initialValues={searchSettings}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Search Mode"
                name="mode"
              >
                <Select defaultValue="fuzzy">
                  <Option value="exact">Exact Match</Option>
                  <Option value="fuzzy">Fuzzy Search</Option>
                  <Option 
                    value="word-based" 
                    title="Splits query into separate words and matches ALL of them. Examples: 'star wars' matches files containing both 'star' AND 'wars', 'final fantasy' matches files with both words"
                  >
                    Word-based (Windows-like)
                  </Option>
                  <Option value="regex">Regex</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Search In"
                name="searchIn"
              >
                <Select defaultValue="both">
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
                <Select defaultValue="both">
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
                label="Ancestor Mode (Folder Mode)"
                name="ancestorMode"
                tooltip={
                  <div>
                    <div><strong>Option 1 – From match:</strong> Include the last N parents above the result (… E → D → C → B → Match).</div>
                    <div><strong>Option 2 – From root:</strong> Count from the top and start the visible chain at level N (A → B → C → D → … → Match).</div>
                  </div>
                }
              >
                <Select defaultValue="from-root">
                  <Option value="from-match">Option 1 — From match (last N parents)</Option>
                  <Option value="from-root">Option 2 — From root (top N levels)</Option>
                </Select>
              </Form.Item>
            </Col>
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

            <Col span={8}>
              <Form.Item
                label="Ancestor Levels (Folder Mode)"
                name="ancestorLevels"
                tooltip="Số level ancestors để hiển thị. Cách tính được chọn ở 'Ancestor Mode'. 0 = tắt"
                rules={[{ type: 'number', min: 0, max: 20 }]}
              >
                <InputNumber min={0} max={20} style={{ width: '100%' }} />
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
        destroyOnHidden={true}
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
            tooltip={
              <div style={{ maxWidth: 400, color: '#ffffff' }}>
                <div style={{ marginBottom: 8, fontWeight: 600, color: '#ffffff' }}>⚠️ Lưu ý quan trọng về dữ liệu:</div>
                
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#ffffff' }}>📁 Folder Only (Structure):</strong>
                  <ul style={{ margin: '4px 0 0 16px', paddingLeft: 0, color: '#ffffff' }}>
                    <li style={{ color: '#ffffff' }}>✅ Quét cấu trúc thư mục (nhanh)</li>
                    <li style={{ color: '#ffffff' }}>✅ Giữ nguyên dữ liệu file đã có</li>
                    <li style={{ color: '#ffffff' }}>❌ Không quét thông tin file chi tiết</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: '#ffffff' }}>📄 File Detail (With Metadata):</strong>
                  <ul style={{ margin: '4px 0 0 16px', paddingLeft: 0, color: '#ffffff' }}>
                    <li style={{ color: '#ffffff' }}>✅ Quét cả folder + file chi tiết (chậm)</li>
                    <li style={{ color: '#ffffff' }}>⚠️ Xóa toàn bộ dữ liệu cũ trong path này</li>
                    <li style={{ color: '#ffffff' }}>✅ Tạo lại dữ liệu hoàn chỉnh</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: '#fff7e6', padding: 8, borderRadius: 4, border: '1px solid #ffd591', color: '#000000' }}>
                  <strong style={{ color: '#000000' }}>💡 Ví dụ:</strong><br/>
                  <span style={{ color: '#000000' }}>1️⃣ Scan File: <code style={{ color: '#d32f2f' }}>C:\Media</code> → Có cả folder + file data</span><br/>
                  <span style={{ color: '#000000' }}>2️⃣ Scan Folder: <code style={{ color: '#d32f2f' }}>C:\Media</code> → Giữ file data, chỉ cập nhật folder</span><br/>
                  <span style={{ color: '#000000' }}>3️⃣ Scan File lại: <code style={{ color: '#d32f2f' }}>C:\Media</code> → Xóa tất cả, tạo mới hoàn toàn</span>
                </div>
              </div>
            }
          >
            <Select 
              placeholder="Chọn loại quét dữ liệu"
              optionLabelProp="label"
            >
              <Option value="folder" label="📁 Folder Only (Structure)">
                <Space>
                  <FolderOutlined style={{ color: '#52c41a' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#262626' }}>Folder Only (Structure)</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      Nhanh • Giữ nguyên file data • Chỉ cập nhật cấu trúc folder
                    </div>
                  </div>
                </Space>
              </Option>
              <Option value="file" label="📄 File Detail (With Metadata)">
                <Space>
                  <FileOutlined style={{ color: '#1890ff' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#262626' }}>File Detail (With Metadata)</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      Chậm • Xóa data cũ • Tạo mới hoàn chỉnh folder + file
                    </div>
                  </div>
                </Space>
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
            <Col span={8}>
              <Form.Item
                label="Max Depth"
                name="maxDepth"
                tooltip="Maximum folder depth to scan (0 = unlimited)"
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Include Extensions (file mode only)"
                name="includeExtensions"
                tooltip="Leave empty to include all files"
              >
                <Select
                  mode="tags"
                  placeholder="e.g., .mp4, .jpg, .pdf"
                  style={{ width: '100%' }}
                  showSearch
                  maxTagCount={5}
                  maxTagPlaceholder={(omitted) => `+${omitted.length}`}
                  onChange={(vals) => {
                    const normalized = normalizeExtensions(vals);
                    scanForm.setFieldsValue({ includeExtensions: normalized });
                  }}
                  filterOption={(input, option) => {
                    const toL = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
                    const q = toL(input);
                    return toL(option?.label).includes(q) || toL(option?.value).includes(q);
                  }}
                >
                  <Select.OptGroup label={renderGroupLabel('includeExtensions', '🎬 Video Files', INCLUDE_GROUPS['🎬 Video Files'])}>
                    <Option value=".mp4">.mp4</Option>
                    <Option value=".mkv">.mkv</Option>
                    <Option value=".avi">.avi</Option>
                    <Option value=".mov">.mov</Option>
                    <Option value=".wmv">.wmv</Option>
                    <Option value=".flv">.flv</Option>
                    <Option value=".webm">.webm</Option>
                    <Option value=".m4v">.m4v</Option>
                    <Option value=".mpg">.mpg</Option>
                    <Option value=".mpeg">.mpeg</Option>
                    <Option value=".3gp">.3gp</Option>
                    <Option value=".ts">.ts</Option>
                    <Option value=".vob">.vob</Option>
                    <Option value=".rmvb">.rmvb</Option>
                    <Option value=".asf">.asf</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('includeExtensions', '🎵 Audio Files', INCLUDE_GROUPS['🎵 Audio Files'])}>
                    <Option value=".mp3">.mp3</Option>
                    <Option value=".wav">.wav</Option>
                    <Option value=".flac">.flac</Option>
                    <Option value=".aac">.aac</Option>
                    <Option value=".m4a">.m4a</Option>
                    <Option value=".ogg">.ogg</Option>
                    <Option value=".wma">.wma</Option>
                    <Option value=".aiff">.aiff</Option>
                    <Option value=".opus">.opus</Option>
                    <Option value=".ac3">.ac3</Option>
                    <Option value=".dts">.dts</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('includeExtensions', '🖼️ Image Files', INCLUDE_GROUPS['🖼️ Image Files'])}>
                    <Option value=".jpg">.jpg</Option>
                    <Option value=".jpeg">.jpeg</Option>
                    <Option value=".png">.png</Option>
                    <Option value=".gif">.gif</Option>
                    <Option value=".bmp">.bmp</Option>
                    <Option value=".webp">.webp</Option>
                    <Option value=".tiff">.tiff</Option>
                    <Option value=".tga">.tga</Option>
                    <Option value=".ico">.ico</Option>
                    <Option value=".svg">.svg</Option>
                    <Option value=".psd">.psd</Option>
                    <Option value=".raw">.raw</Option>
                    <Option value=".cr2">.cr2</Option>
                    <Option value=".nef">.nef</Option>
                    <Option value=".arw">.arw</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('includeExtensions', '📄 Documents', INCLUDE_GROUPS['📄 Documents'])}>
                    <Option value=".pdf">.pdf</Option>
                    <Option value=".doc">.doc</Option>
                    <Option value=".docx">.docx</Option>
                    <Option value=".xls">.xls</Option>
                    <Option value=".xlsx">.xlsx</Option>
                    <Option value=".ppt">.ppt</Option>
                    <Option value=".pptx">.pptx</Option>
                    <Option value=".txt">.txt</Option>
                    <Option value=".rtf">.rtf</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('includeExtensions', '📦 Archives', INCLUDE_GROUPS['📦 Archives'])}>
                    <Option value=".zip">.zip</Option>
                    <Option value=".rar">.rar</Option>
                    <Option value=".7z">.7z</Option>
                    <Option value=".tar">.tar</Option>
                    <Option value=".gz">.gz</Option>
                    <Option value=".iso">.iso</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('includeExtensions', '💻 Code Files', INCLUDE_GROUPS['💻 Code Files'])}>
                    <Option value=".js">.js</Option>
                    <Option value=".css">.css</Option>
                    <Option value=".html">.html</Option>
                    <Option value=".json">.json</Option>
                    <Option value=".xml">.xml</Option>
                    <Option value=".py">.py</Option>
                    <Option value=".java">.java</Option>
                    <Option value=".cpp">.cpp</Option>
                    <Option value=".cs">.cs</Option>
                    <Option value=".php">.php</Option>
                  </Select.OptGroup>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Exclude Extensions (file mode only)"
                name="excludeExtensions"
                tooltip="Files with these extensions will be skipped"
              >
                <Select
                  mode="tags"
                  placeholder="e.g., .tmp, .log, .cache"
                  style={{ width: '100%' }}
                  showSearch
                  maxTagCount={5}
                  maxTagPlaceholder={(omitted) => `+${omitted.length}`}
                  onChange={(vals) => {
                    const normalized = normalizeExtensions(vals);
                    scanForm.setFieldsValue({ excludeExtensions: normalized });
                  }}
                  filterOption={(input, option) => {
                    const toL = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
                    const q = toL(input);
                    return toL(option?.label).includes(q) || toL(option?.value).includes(q);
                  }}
                >
                  <Select.OptGroup label={renderGroupLabel('excludeExtensions', '🗑️ Temporary Files', EXCLUDE_GROUPS['🗑️ Temporary Files'])}>
                    <Option value=".tmp">.tmp</Option>
                    <Option value=".temp">.temp</Option>
                    <Option value=".cache">.cache</Option>
                    <Option value=".bak">.bak</Option>
                    <Option value=".old">.old</Option>
                    <Option value=".~">.~</Option>
                    <Option value=".$$$">.$$$</Option>
                    <Option value=".backup">.backup</Option>
                    <Option value=".orig">.orig</Option>
                    <Option value=".part">.part</Option>
                    <Option value=".crdownload">.crdownload</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('excludeExtensions', '📝 Log/System Files', EXCLUDE_GROUPS['📝 Log/System Files'])}>
                    <Option value=".log">.log</Option>
                    <Option value=".swp">.swp</Option>
                    <Option value=".swo">.swo</Option>
                    <Option value=".ds_store">.ds_store</Option>
                    <Option value=".thumbs.db">.thumbs.db</Option>
                    <Option value=".desktop.ini">.desktop.ini</Option>
                    <Option value=".ini">.ini</Option>
                    <Option value=".db">.db</Option>
                    <Option value=".lock">.lock</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('excludeExtensions', '🖥️ Windows System', EXCLUDE_GROUPS['🖥️ Windows System'])}>
                    <Option value=".sys">.sys</Option>
                    <Option value=".dll">.dll</Option>
                    <Option value=".lnk">.lnk</Option>
                    <Option value=".exe">.exe</Option>
                    <Option value=".msi">.msi</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('excludeExtensions', '💻 Development', EXCLUDE_GROUPS['💻 Development'])}>
                    <Option value=".git">.git</Option>
                    <Option value=".gitignore">.gitignore</Option>
                    <Option value=".node_modules">.node_modules</Option>
                    <Option value=".env">.env</Option>
                    <Option value=".o">.o</Option>
                    <Option value=".obj">.obj</Option>
                  </Select.OptGroup>
                  
                  <Select.OptGroup label={renderGroupLabel('excludeExtensions', '🌐 Web/Shortcuts', EXCLUDE_GROUPS['🌐 Web/Shortcuts'])}>
                    <Option value=".torrent">.torrent</Option>
                    <Option value=".url">.url</Option>
                    <Option value=".webloc">.webloc</Option>
                  </Select.OptGroup>
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
        destroyOnHidden={true}
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
