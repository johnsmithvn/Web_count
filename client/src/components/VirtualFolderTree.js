import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Typography, Modal, Space, message, Input } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined,
  CopyOutlined,
  ExportOutlined,
  ShrinkOutlined,
  ArrowsAltOutlined,
  SearchOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/api';

const { Text } = Typography;
const { Search } = Input;

// Virtual Tree Node Component
const TreeNode = ({ 
  node, 
  level = 0, 
  isExpanded, 
  onToggle, 
  onSelect, 
  children = null,
  isLoading = false,
  isHighlight = false
}) => {
  const indentSize = 24;
  const hasChildren = node.hasChildren || (children && children.length > 0);

  return (
    <div>
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          paddingLeft: 8 + (level * indentSize),
          cursor: 'pointer',
          borderRadius: '4px',
          ':hover': { backgroundColor: '#f5f5f5' }
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
      >
        {/* Expand/Collapse Icon */}
        <div 
          style={{ 
            width: 16, 
            height: 16, 
            marginRight: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node);
          }}
        >
          {hasChildren && (
            isLoading ? (
              <LoadingOutlined style={{ fontSize: 12 }} />
            ) : (
              <span style={{ 
                fontSize: 12, 
                color: '#666',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}>
                ▶
              </span>
            )
          )}
        </div>

        {/* Folder Icon */}
        <div style={{ marginRight: 8 }}>
          {isExpanded && hasChildren ? 
            <FolderOpenOutlined style={{ color: '#1890ff' }} /> : 
            <FolderOutlined style={{ color: '#1890ff' }} />
          }
        </div>

        {/* Folder Name */}
        <Text 
          style={{ 
            flex: 1, 
            userSelect: 'none', 
            fontWeight: isHighlight ? 600 : 400,
            color: isHighlight ? '#d4380d' : 'inherit'
          }}
          onClick={() => onSelect(node)}
          title={`${node.name}\nPath: ${node.path}\nLevel: ${node.level}`}
        >
          {node.name}
        </Text>
      </div>

      {/* Children */}
      {isExpanded && children && (
        <div>
          {children}
        </div>
      )}
    </div>
  );
};

const VirtualFolderTree = ({ searchResults, refreshTrigger }) => {
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [loadingPaths, setLoadingPaths] = useState(new Set());
  const [childrenCache, setChildrenCache] = useState(new Map());
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [highlightPaths, setHighlightPaths] = useState(new Set());
  const [anchorPaths, setAnchorPaths] = useState(new Set());
  const [showAllFromPaths, setShowAllFromPaths] = useState(new Set());

  // Hard reset tree state when search results change (clear or new search)
  useEffect(() => {
    // Reset internal caches and UI state so a new search starts clean
    setExpandedPaths(new Set());
    setLoadingPaths(new Set());
    setChildrenCache(new Map());
    setSelectedFolder(null);
    setModalVisible(false);
    setSearchTerm('');
  setHighlightPaths(new Set());
  setAnchorPaths(new Set());
  setShowAllFromPaths(new Set());
    // Note: expandPaths and helpers will be applied by the effect below if present
  }, [searchResults]);

  // Auto expand paths provided by search results (e.g., ancestors + target)
  useEffect(() => {
    if (!searchResults?.expandPaths || !Array.isArray(searchResults.expandPaths)) return;
    const toExpand = new Set(expandedPaths);
    searchResults.expandPaths.forEach(p => toExpand.add(p));
    setExpandedPaths(toExpand);
  // New multi-value helpers
  if (Array.isArray(searchResults.highlightPaths)) setHighlightPaths(new Set(searchResults.highlightPaths));
  else if (searchResults.highlightPath) setHighlightPaths(new Set([searchResults.highlightPath]));

  if (Array.isArray(searchResults.anchorPaths)) setAnchorPaths(new Set(searchResults.anchorPaths));
  else if (searchResults.anchorPath) setAnchorPaths(new Set([searchResults.anchorPath]));

  if (Array.isArray(searchResults.showAllFromPaths)) setShowAllFromPaths(new Set(searchResults.showAllFromPaths));
  else if (searchResults.showAllFromPath) setShowAllFromPaths(new Set([searchResults.showAllFromPath]));

    // Preload children for each path in the chain to make them visible
    (async () => {
      for (const p of searchResults.expandPaths) {
        if (!childrenCache.has(p)) {
          await loadChildren(p);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults?.expandPaths]);

  // Extract root folders (level 0 or folders without parents in current search)
  const rootFolders = useMemo(() => {
    if (!searchResults?.folders) return [];
    // If anchorPaths present, show only those nodes at the top (support multiple branches)
    if (anchorPaths && anchorPaths.size > 0) {
      const anchors = searchResults.folders.filter(f => anchorPaths.has(f.path));
      return anchors.sort((a, b) => a.name.localeCompare(b.name));
    }

    const folders = searchResults.folders;
    const pathSet = new Set(folders.map(f => f.path));
    
    return folders.filter(folder => {
      // Root if level is 0 OR parent is not in current search results
      return folder.level === 0 || !pathSet.has(folder.parent_path);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [searchResults, anchorPaths]);

  // Filter folders based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredNodes(rootFolders);
      return;
    }

    const filtered = rootFolders.filter(folder =>
      folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      folder.path.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredNodes(filtered);
  }, [rootFolders, searchTerm]);

  // Load children for a specific folder path
  const loadChildren = useCallback(async (parentPath) => {
    if (childrenCache.has(parentPath)) {
      return childrenCache.get(parentPath);
    }

    setLoadingPaths(prev => new Set([...prev, parentPath]));

    try {
      // Use new children API for lazy loading
      const response = await ApiService.getChildren(parentPath);

      if (response?.success && response?.children) {
        const children = response.children.sort((a, b) => a.name.localeCompare(b.name));

        setChildrenCache(prev => new Map([...prev, [parentPath, children]]));
        setLoadingPaths(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentPath);
          return newSet;
        });

        return children;
      }
    } catch (error) {
      console.error('Error loading children:', error);
      message.error('Failed to load subfolder data');
    }

    setLoadingPaths(prev => {
      const newSet = new Set(prev);
      newSet.delete(parentPath);
      return newSet;
    });
    return [];
  }, [childrenCache]);

  // Toggle expand/collapse for a folder
  const handleToggle = useCallback(async (folder) => {
    const path = folder.path;
    const isCurrentlyExpanded = expandedPaths.has(path);

    if (isCurrentlyExpanded) {
      // Collapse
      setExpandedPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    } else {
      // Expand
      setExpandedPaths(prev => new Set([...prev, path]));
      
      // Load children if not already cached
      if (!childrenCache.has(path)) {
        await loadChildren(path);
      }
    }
  }, [expandedPaths, childrenCache, loadChildren]);

  // Select folder to view details
  const handleSelect = useCallback((folder) => {
    setSelectedFolder(folder);
    setModalVisible(true);
  }, []);

  // Recursive render with lazy loading
  const renderNode = useCallback((folder, level = 0) => {
    const path = folder.path;
    const isExpanded = expandedPaths.has(path);
    const isLoading = loadingPaths.has(path);
    let children = childrenCache.get(path) || [];
    const hasChildren = folder.hasChildren || children.length > 0;

    // If we don't know if this folder has children, assume it might
    // (This could be enhanced with a backend API that returns child counts)
    folder.hasChildren = hasChildren || folder.level < 10; // Assume folders can have children

  const isHighlight = highlightPaths.has(path);

    // If this node is the anchor, restrict visible children to the single branch child
    if (anchorPaths.size > 0 && showAllFromPaths.size > 0 && anchorPaths.has(path) && children.length > 0) {
      // Keep only children that are part of any branch towards matches
      children = children.filter(ch => showAllFromPaths.has(ch.path) || highlightPaths.has(ch.path));
    }

  return (
    <TreeNode
        key={path}
        node={folder}
        level={level}
        isExpanded={isExpanded}
        onToggle={handleToggle}
        onSelect={handleSelect}
    isLoading={isLoading}
    isHighlight={isHighlight}
        children={
          isExpanded && children.length > 0 
            ? children.map(child => renderNode(child, level + 1))
            : null
        }
      />
    );
  }, [expandedPaths, loadingPaths, childrenCache, handleToggle, handleSelect, highlightPaths, anchorPaths, showAllFromPaths]);

  // Expand all visible nodes (first 2 levels only to prevent performance issues)
  const expandAll = useCallback(() => {
    const pathsToExpand = new Set();
    
    // Expand root level
    filteredNodes.forEach(folder => {
      pathsToExpand.add(folder.path);
    });

    setExpandedPaths(pathsToExpand);
    
    // Load children for all root folders
    filteredNodes.forEach(folder => {
      if (!childrenCache.has(folder.path)) {
        loadChildren(folder.path);
      }
    });
  }, [filteredNodes, childrenCache, loadChildren]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // Copy path utility
  const copyPath = useCallback((path) => {
    navigator.clipboard.writeText(path).then(() => {
      message.success('Path copied to clipboard!');
    }).catch(() => {
      message.error('Failed to copy path');
    });
  }, []);

  // Export functionality
  const exportFolders = useCallback(async () => {
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
  }, []);

  // Format date utility
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  if (!searchResults) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Text type="secondary">No folder data available. Run a folder scan to populate the database.</Text>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card 
        title={`Virtual Folder Tree (${searchResults?.totalFolders || filteredNodes.length} folders)`}
        extra={
          <Space>
            <Search
              placeholder="Filter folders..."
              allowClear
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
              size="small"
            />
            <Button 
              icon={<ArrowsAltOutlined />} 
              onClick={expandAll}
              size="small"
              title="Expand visible folders"
            >
              Expand
            </Button>
            <Button 
              icon={<ShrinkOutlined />} 
              onClick={collapseAll}
              size="small"
              title="Collapse all"
            >
              Collapse
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
        <div style={{ 
          maxHeight: '70vh', 
          overflowY: 'auto',
          border: '1px solid #f0f0f0',
          borderRadius: '6px',
          backgroundColor: '#fafafa'
        }}>
          {filteredNodes.length > 0 ? (
            <div style={{ padding: '8px' }}>
              {filteredNodes.map(folder => renderNode(folder, 0))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
              {searchTerm ? 'No folders found matching your filter.' : 'No folders found.'}
            </div>
          )}
        </div>
      </Card>

      {/* Folder Details Modal */}
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

export default VirtualFolderTree;
