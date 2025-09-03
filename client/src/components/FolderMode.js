import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tree, Alert, Button, Typography, Row, Col } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined,
  CopyOutlined,
  ExportOutlined 
} from '@ant-design/icons';
import { ApiService } from '../services/api';

const { Text, Title } = Typography;

const FolderMode = ({ searchResults, refreshTrigger }) => {
  const [treeData, setTreeData] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState([]);

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
    }
  };

  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  const copyPath = (path) => {
    navigator.clipboard.writeText(path).then(() => {
      console.log('Path copied to clipboard');
    });
  };

  const exportFolders = async () => {
    try {
      const blob = await ApiService.exportData('folders');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'folders.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
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
    <Row gutter={16}>
      <Col span={12}>
        <Card 
          title="Folder Structure" 
          extra={
            <Button 
              icon={<ExportOutlined />} 
              onClick={exportFolders}
              size="small"
            >
              Export
            </Button>
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
      </Col>

      <Col span={12}>
        <Card title="Folder Details">
          {selectedFolder ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>
                  <FolderOpenOutlined style={{ marginRight: 8 }} />
                  {selectedFolder.name}
                </Title>
                <Button 
                  icon={<CopyOutlined />} 
                  size="small"
                  onClick={() => copyPath(selectedFolder.path)}
                  style={{ marginLeft: 8 }}
                >
                  Copy Path
                </Button>
              </div>

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
              Select a folder from the tree to view its details.
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default FolderMode;
