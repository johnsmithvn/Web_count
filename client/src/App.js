import React, { useState } from 'react';
import { Layout, Tabs, ConfigProvider, App as AntApp } from 'antd';
import 'antd/dist/reset.css';
import './App.css';

import Dashboard from './components/Dashboard';
import FolderMode from './components/FolderMode';
import FileMode from './components/FileMode';
import SearchPanel from './components/SearchPanel';
import { ApiService } from './services/api';

const { Header, Content } = Layout;

function App() {
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSearch = async (searchParams) => {
    setLoading(true);
    try {
      const results = await ApiService.search(searchParams);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      throw error; // Re-throw to let SearchPanel handle the toast
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (scanType, scanParams) => {
    setLoading(true);
    try {
      const result = await ApiService.scan(scanType, scanParams);
      setRefreshTrigger(prev => prev + 1);
      setSearchResults(null); // Clear search results after scan
      return result; // Return result for SearchPanel to show success message
    } catch (error) {
      console.error('Scan error:', error);
      throw error; // Re-throw to let SearchPanel handle the toast
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
  };

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
        <FolderMode 
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
        />
      )
    }
  ];

  return (
    <ConfigProvider>
      <AntApp>
        <Layout style={{ minHeight: '100vh' }}>
          <Header style={{ 
            backgroundColor: '#001529', 
            color: 'white', 
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <h1 style={{ color: 'white', margin: 0, fontSize: '20px' }}>
              Media Database Manager
            </h1>
          </Header>
          
          <Content style={{ padding: '24px' }}>
            <SearchPanel 
              onSearch={handleSearch}
              onScan={handleScan}
              onClearSearch={clearSearch}
              loading={loading}
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
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
