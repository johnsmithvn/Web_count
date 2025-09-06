// Dynamic API base URL - use current host but port 5000 for backend
const getApiBaseUrl = () => {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000/api`;
};

const API_BASE_URL = getApiBaseUrl();

export class ApiService {
  static async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  static async scan(type, params) {
    return this.request(`/scan/${type}`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  static async getChildren(parentPath) {
    const encodedPath = encodeURIComponent(parentPath);
    return this.request(`/search/children/${encodedPath}`);
  }

  static async search(params) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/search?${queryString}`);
  }

  static async searchFts(params) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/search/fts?${queryString}`);
  }

  static async getStats() {
    return this.request('/stats');
  }

  static async getPathStats(path) {
    const queryString = new URLSearchParams({ path }).toString();
    return this.request(`/stats/path?${queryString}`);
  }

  static async getExtensions() {
    return this.request('/search/extensions');
  }

  static async exportData(type, format = 'csv') {
    const queryString = new URLSearchParams({ type, format }).toString();
    const response = await fetch(`${getApiBaseUrl()}/stats/export?${queryString}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Export failed');
    }

    return response.blob();
  }

  static async getScanStatus() {
    return this.request('/scan/status');
  }

  // Delete operations
  static async deleteByPath(rootPath, deleteType = 'both') {
    return this.request('/delete', {
      method: 'DELETE',
      body: JSON.stringify({ rootPath, deleteType })
    });
  }

  static async deleteFile(fileId) {
    return this.request(`/delete/file/${fileId}`, {
      method: 'DELETE'
    });
  }

  static async deleteAll() {
    return this.request('/delete/all', {
      method: 'DELETE'
    });
  }

  static async previewDelete(rootPath, deleteType = 'both') {
    return this.request('/delete/preview', {
      method: 'POST',
      body: JSON.stringify({ rootPath, deleteType })
    });
  }

  // Add operations
  static async addFile(fileData) {
    return this.request('/add/file', {
      method: 'POST',
      body: JSON.stringify(fileData)
    });
  }

  static async addFolder(folderData) {
    return this.request('/add/folder', {
      method: 'POST',
      body: JSON.stringify(folderData)
    });
  }
}
