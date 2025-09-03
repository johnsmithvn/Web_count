import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Select, 
  Row, 
  Col, 
  InputNumber,
  DatePicker,
  message,
  Space,
  Divider,
  Typography
} from 'antd';
import { 
  FileOutlined, 
  FolderOutlined,
  SaveOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';

const { Option } = Select;
const { Title, Text } = Typography;

const AddFilesMode = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleAddFile = async (values) => {
    try {
      setLoading(true);
      
      const fileData = {
        name: values.name,
        path: values.path,
        extension: values.extension || '',
        size: values.size || 0,
        created_at: values.created_at?.format('YYYY-MM-DD HH:mm:ss') || new Date().toISOString(),
        modified_at: values.modified_at?.format('YYYY-MM-DD HH:mm:ss') || new Date().toISOString(),
        accessed_at: values.accessed_at?.format('YYYY-MM-DD HH:mm:ss') || new Date().toISOString()
      };

      const result = await ApiService.addFile(fileData);
      
      message.success(`File added successfully! ${result.message || ''}`);
      form.resetFields();
      
    } catch (error) {
      message.error('Failed to add file: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    form.resetFields();
    message.info('Form cleared');
  };

  const handleAutoFillExtension = (name) => {
    if (name && name.includes('.')) {
      const extension = name.substring(name.lastIndexOf('.'));
      form.setFieldsValue({ extension });
    }
  };

  return (
    <div>
      <Card title="Add New File" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
          <Text>
            <FileOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            <strong>Add files manually to the database.</strong> Required fields: Name and Path. 
            Other fields are optional and will use default values if not provided.
          </Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddFile}
          initialValues={{
            size: 0
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="File Name"
                name="name"
                rules={[
                  { required: true, message: 'File name is required!' },
                  { min: 1, message: 'File name cannot be empty!' }
                ]}
                tooltip="Full filename including extension (e.g., 'document.pdf', 'Amagami SS 01.mp4')"
              >
                <Input
                  placeholder="e.g., Amagami SS 01.mp4"
                  prefix={<FileOutlined />}
                  onChange={(e) => handleAutoFillExtension(e.target.value)}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="File Path"
                name="path"
                rules={[
                  { required: true, message: 'File path is required!' },
                  { min: 1, message: 'File path cannot be empty!' }
                ]}
                tooltip="Full path to the file location (e.g., 'E:\\Media\\Anime\\Amagami SS')"
              >
                <Input
                  placeholder="e.g., E:\Media\Anime\Amagami SS"
                  prefix={<FolderOutlined />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Extension"
                name="extension"
                tooltip="File extension (auto-filled from filename)"
              >
                <Input
                  placeholder="e.g., .mp4, .jpg, .pdf"
                  disabled
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="File Size (bytes)"
                name="size"
                tooltip="File size in bytes (0 if unknown)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="0"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Priority"
                name="priority"
                tooltip="Optional priority level for this file"
              >
                <Select placeholder="Select priority">
                  <Option value="low">Low</Option>
                  <Option value="normal">Normal</Option>
                  <Option value="high">High</Option>
                  <Option value="urgent">Urgent</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Optional Timestamps</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Created Date"
                name="created_at"
                tooltip="When the file was created (defaults to current time)"
              >
                <DatePicker 
                  showTime 
                  style={{ width: '100%' }}
                  placeholder="Select creation date"
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Modified Date"
                name="modified_at"
                tooltip="When the file was last modified (defaults to current time)"
              >
                <DatePicker 
                  showTime 
                  style={{ width: '100%' }}
                  placeholder="Select modified date"
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Accessed Date"
                name="accessed_at"
                tooltip="When the file was last accessed (defaults to current time)"
              >
                <DatePicker 
                  showTime 
                  style={{ width: '100%' }}
                  placeholder="Select accessed date"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Row justify="end">
            <Col>
              <Space>
                <Button 
                  icon={<ClearOutlined />}
                  onClick={handleClear}
                >
                  Clear Form
                </Button>
                
                <Button 
                  type="primary"
                  icon={<SaveOutlined />}
                  htmlType="submit"
                  loading={loading}
                  size="large"
                >
                  Add File
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="Examples" size="small">
        <div style={{ fontSize: '14px' }}>
          <Title level={5}>Sample Entries:</Title>
          <div style={{ marginBottom: 8 }}>
            <Text strong>Name:</Text> <Text code>Amagami SS 01.mp4</Text><br />
            <Text strong>Path:</Text> <Text code>E:\Media\Anime\Amagami SS</Text>
          </div>
          <div style={{ marginBottom: 8 }}>
            <Text strong>Name:</Text> <Text code>Final Fantasy VII.iso</Text><br />
            <Text strong>Path:</Text> <Text code>D:\Games\PSX\Final Fantasy</Text>
          </div>
          <div>
            <Text strong>Name:</Text> <Text code>Star Wars - Episode IV.mkv</Text><br />
            <Text strong>Path:</Text> <Text code>F:\Movies\Star Wars Collection</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AddFilesMode;
