import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tree, Alert, Button, Typography, Modal, Space, message } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined,
  CopyOutlined,
  ExportOutlined,
  ShrinkOutlined,
  ArrowsAltOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';

const { Text } = Typography;

const FolderMode = ({ searchResults, refreshTrigger }) => {
  const [treeData, setTreeData] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const buildTreeFromSearchResults = useCallback(() => {
    if (!searchResults?.folders) return;

    const folders = searchResults.folders;
    const treeMap = new Map();
    
    // Create tree nodes
    folders.forEach(folder => {
      const key = folder.path;
      
      treeMap.set(key, {
        title: folder.name,
        key: key,
        icon: <FolderOutlined />,
        children: [],
        isLeaf: false,
        data: folder
      });
    });

    // Build hierarchy
    const rootNodes = [];
    const processedPaths = new Set();

    folders.forEach(folder => {
      if (processedPaths.has(folder.path)) return;
      
      const node = treeMap.get(folder.path);
      if (!node) return;

      // Find parent
      let parentPath = folder.parent_path;
      let parentNode = null;
      
      if (parentPath && treeMap.has(parentPath)) {
        parentNode = treeMap.get(parentPath);
      }

      if (parentNode) {
        // Add to parent's children if not already there
        if (!parentNode.children.find(child => child.key === node.key)) {
          parentNode.children.push(node);
        }
      } else {
        // Root level folder
        if (!rootNodes.find(root => root.key === node.key)) {
          rootNodes.push(node);
        }
      }
      
      processedPaths.add(folder.path);
    });

    // Sort children by name
    const sortTree = (nodes) => {
      nodes.sort((a, b) => a.title.localeCompare(b.title));
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortTree(node.children);
        }
      });
    };

    sortTree(rootNodes);
    setTreeData(rootNodes);
  }, [searchResults]);

  useEffect(() => {
    if (searchResults && searchResults.folders) {
      buildTreeFromSearchResults();
    } else {
      // If no search results, we could load a default view or show empty state
      setTreeData([]);
    }
  }, [searchResults, refreshTrigger, buildTreeFromSearchResults]);

  const handleSelect = (selectedKeys, info) => {
    if (selectedKeys.length > 0 && info.node.data) {
      setSelectedFolder(info.node.data);
      setModalVisible(true);
    }
  };

  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  const expandAll = () => {
    const getAllKeys = (nodes) => {
      let keys = [];
      nodes.forEach(node => {
        keys.push(node.key);
        if (node.children && node.children.length > 0) {
          keys = keys.concat(getAllKeys(node.children));
        }
      });
      return keys;
    };
    
    setExpandedKeys(getAllKeys(treeData));
  };

  const collapseAll = () => {
    setExpandedKeys([]);
  };

  const copyPath = (path) => {
    navigator.clipboard.writeText(path).then(() => {
      message.success('Path copied to clipboard!');
    }).catch(() => {
      message.error('Failed to copy path');
    });
  };

  const exportFolders = async () => {
    try {
      setExportLoading(true);
      const blob = await ApiService.exportData('folders');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'folders.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('Folders exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Export failed: ' + (error.message || 'Unknown error'));
    } finally {
      setExportLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (!searchResults) {
    return (
      <Alert
        message="No Folder Data"
        description="Use the search panel above to find folders or run a folder scan to populate the database."
        type="info"
        showIcon
      />
    );
  }

  return (
    <div>
      <Card 
        title="Folder Structure" 
        extra={
          <Space>
            <Button 
              icon={<ArrowsAltOutlined />} 
              onClick={expandAll}
              size="small"
              title="Expand All"
            >
              Expand All
            </Button>
            <Button 
              icon={<ShrinkOutlined />} 
              onClick={collapseAll}
              size="small"
              title="Collapse All"
            >
              Collapse All
            </Button>
            <Button 
              icon={<ExportOutlined />} 
              onClick={exportFolders}
              size="small"
              loading={exportLoading}
            >
              Export
            </Button>
          </Space>
        }
      >
        {treeData.length > 0 ? (
          <Tree
            showIcon
            treeData={treeData}
            onSelect={handleSelect}
            onExpand={handleExpand}
            expandedKeys={expandedKeys}
            style={{ 
              maxHeight: '600px', 
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: '6px',
              padding: '8px'
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
            No folders found matching your search criteria.
          </div>
        )}
      </Card>

      <Modal
        title={selectedFolder ? (
          <span>
            <FolderOpenOutlined style={{ marginRight: 8 }} />
            {selectedFolder.name}
          </span>
        ) : "Folder Details"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        destroyOnHidden={true}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => selectedFolder && copyPath(selectedFolder.path)}>
            Copy Path
          </Button>,
          <Button key="close" onClick={() => setModalVisible(false)}>
            Close
          </Button>
        ]}
        width={600}
      >
        {selectedFolder ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text strong>Full Path: </Text>
              <Text code style={{ wordBreak: 'break-all' }}>
                {selectedFolder.path}
              </Text>
            </div>

            {selectedFolder.parent_path && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>Parent: </Text>
                <Text>{selectedFolder.parent_path}</Text>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <Text strong>Level: </Text>
              <Text>{selectedFolder.level}</Text>
            </div>

            <div style={{ marginBottom: 12 }}>
              <Text strong>Created: </Text>
              <Text>{formatDate(selectedFolder.created_at)}</Text>
            </div>

            <div style={{ marginBottom: 12 }}>
              <Text strong>Modified: </Text>
              <Text>{formatDate(selectedFolder.modified_at)}</Text>
            </div>

            <div style={{ marginBottom: 12 }}>
              <Text strong>Accessed: </Text>
              <Text>{formatDate(selectedFolder.accessed_at)}</Text>
            </div>

            <div style={{ marginBottom: 12 }}>
              <Text strong>Scanned: </Text>
              <Text>{formatDate(selectedFolder.scanned_at)}</Text>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
            No folder selected.
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FolderMode;
