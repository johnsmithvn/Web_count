import React, { useState } from 'react';
import { Layout, Tabs, ConfigProvider, App as AntApp, Spin, Button, Dropdown } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import 'antd/dist/reset.css';
import './App.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import VirtualFolderTree from './components/VirtualFolderTree';
import FolderTableMode from './components/FolderTableMode';
import FileMode from './components/FileMode';
import DeleteMode from './components/DeleteMode';
import AddFilesMode from './components/AddFilesMode';
import SearchPanel from './components/SearchPanel';
import { ApiService } from './services/api';

const { Header, Content } = Layout;

const MainApp = () => {
  const { user, logout, loading } = useAuth();
  const [searchResults, setSearchResults] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentSearchParams, setCurrentSearchParams] = useState(null);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const handleSearch = async (searchParams) => {
    setLoadingData(true);
    try {
      const limitEnabled = searchParams.limitEnabled !== false && searchParams.limitEnabled !== 'false';
      const parsedLimit = Number(searchParams.limit);
      const normalizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;

      // Add default pagination if not provided
      const searchWithPagination = {
        ...searchParams,
        page: searchParams.page || 1
      };

      if (limitEnabled) {
        searchWithPagination.limit = normalizedLimit;
        searchWithPagination.limitEnabled = true;
      } else {
        delete searchWithPagination.limit;
        searchWithPagination.limitEnabled = false;
      }

      const results = await ApiService.search(searchWithPagination);
      setSearchResults({ ...results, isNewSearch: true });
      setCurrentSearchParams(searchWithPagination);
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    } finally {
      setLoadingData(false);
    }
  };

  const handlePageChange = async (paginationParams) => {
    if (!currentSearchParams) return;

    const limitEnabled = currentSearchParams.limitEnabled !== false && currentSearchParams.limitEnabled !== 'false';
    if (!limitEnabled) {
      return;
    }

    setLoadingData(true);
    try {
      const searchWithNewPagination = {
        ...currentSearchParams,
        ...paginationParams
      };
      
      const results = await ApiService.search(searchWithNewPagination);
      setSearchResults({ ...results, isNewSearch: false });
      setCurrentSearchParams(searchWithNewPagination);
    } catch (error) {
      console.error('Page change error:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleScan = async (scanType, scanParams) => {
    setLoadingData(true);
    try {
      const result = await ApiService.scan(scanType, scanParams);
      setRefreshTrigger(prev => prev + 1);
      setSearchResults(null);
      return result;
    } catch (error) {
      console.error('Scan error:', error);
      throw error;
    } finally {
      setLoadingData(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setCurrentSearchParams(null);
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `Logged in as: ${user.username}`,
      disabled: true
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: logout
    }
  ];

  const tabItems = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      children: <Dashboard refreshTrigger={refreshTrigger} />
    },
    {
      key: 'folders',
      label: 'Folder Mode',
      children: (
        <VirtualFolderTree
          searchResults={searchResults}
          refreshTrigger={refreshTrigger}
        />
      )
    },
    {
      key: 'folder-table',
      label: 'Folder Table',
      children: (
        <FolderTableMode
          searchResults={searchResults}
          refreshTrigger={refreshTrigger}
        />
      )
    },
    {
      key: 'files',
      label: 'File Mode',
      children: (
        <FileMode 
          searchResults={searchResults}
          refreshTrigger={refreshTrigger}
          onPageChange={handlePageChange}
        />
      )
    },
    {
      key: 'delete',
      label: 'Delete Files',
      children: (
        <DeleteMode 
          refreshTrigger={refreshTrigger}
          onRefresh={() => setRefreshTrigger(prev => prev + 1)}
        />
      )
    },
    {
      key: 'add',
      label: 'Add Files',
      children: (
        <AddFilesMode 
          refreshTrigger={refreshTrigger}
          onRefresh={() => setRefreshTrigger(prev => prev + 1)}
        />
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        backgroundColor: '#001529', 
        color: 'white', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: '20px' }}>
          Media Database Manager
        </h1>
        
        <Dropdown 
          menu={{ items: userMenuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button 
            type="text" 
            style={{ color: 'white' }}
            icon={<UserOutlined />}
          >
            {user.username}
          </Button>
        </Dropdown>
      </Header>
      
      <Content style={{ padding: '24px' }}>
        <SearchPanel 
          onSearch={handleSearch}
          onScan={handleScan}
          onClearSearch={clearSearch}
          loading={loadingData}
          hasResults={!!searchResults}
        />
        
        <Tabs 
          defaultActiveKey="dashboard" 
          size="large" 
          style={{ marginTop: 16 }}
          items={tabItems}
        />
      </Content>
    </Layout>
  );
};

function App() {
  return (
    <ConfigProvider>
      <AntApp>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
