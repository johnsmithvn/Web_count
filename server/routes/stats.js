const express = require('express');

const router = express.Router();

// Get database statistics
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    // Basic counts
    db.get('SELECT COUNT(*) as count FROM folders', (err, folderCount) => {
      if (err) {
        return res.status(500).json({ error: 'Could not get folder count' });
      }

      db.get('SELECT COUNT(*) as count FROM files', (err, fileCount) => {
        if (err) {
          return res.status(500).json({ error: 'Could not get file count' });
        }

        // Total size
        db.get('SELECT SUM(size) as total FROM files', (err, totalSize) => {
          if (err) {
            return res.status(500).json({ error: 'Could not get total size' });
          }

          // File type distribution
          db.all(`
            SELECT 
              extension,
              COUNT(*) as count,
              SUM(size) as total_size,
              AVG(size) as avg_size
            FROM files 
            WHERE extension IS NOT NULL AND extension != ''
            GROUP BY extension 
            ORDER BY count DESC
            LIMIT 20
          `, (err, fileTypes) => {
            if (err) {
              console.warn('File types error:', err);
              fileTypes = [];
            }

            // Folder depth distribution
            db.all(`
              SELECT 
                level,
                COUNT(*) as count
              FROM folders 
              GROUP BY level 
              ORDER BY level
            `, (err, folderDepths) => {
              if (err) {
                console.warn('Folder depths error:', err);
                folderDepths = [];
              }

              // Recent scans
              db.get('SELECT MAX(scanned_at) as last_folder_scan FROM folders', (err, recentScans) => {
                if (err) {
                  console.warn('Recent scans error:', err);
                  recentScans = { last_folder_scan: null };
                }

                db.get('SELECT MAX(scanned_at) as last_file_scan FROM files', (err, recentFileScans) => {
                  if (err) {
                    console.warn('Recent file scans error:', err);
                    recentFileScans = { last_file_scan: null };
                  }

                  // Size distribution
                  db.all(`
                    SELECT 
                      CASE 
                        WHEN size < 1024 THEN 'Under 1KB'
                        WHEN size < 1048576 THEN '1KB - 1MB'
                        WHEN size < 104857600 THEN '1MB - 100MB'
                        WHEN size < 1073741824 THEN '100MB - 1GB'
                        ELSE 'Over 1GB'
                      END as size_range,
                      COUNT(*) as count,
                      SUM(size) as total_size
                    FROM files
                    GROUP BY size_range
                    ORDER BY 
                      CASE size_range
                        WHEN 'Under 1KB' THEN 1
                        WHEN '1KB - 1MB' THEN 2
                        WHEN '1MB - 100MB' THEN 3
                        WHEN '100MB - 1GB' THEN 4
                        WHEN 'Over 1GB' THEN 5
                      END
                  `, (err, sizeDistribution) => {
                    if (err) {
                      console.warn('Size distribution error:', err);
                      sizeDistribution = [];
                    }

                    // Top 10 largest files
                    db.all(`
                      SELECT 
                        f.name,
                        f.extension,
                        f.size,
                        folders.path as folder_path
                      FROM files f
                      LEFT JOIN folders ON f.folder_id = folders.id
                      ORDER BY f.size DESC
                      LIMIT 10
                    `, (err, largestFiles) => {
                      if (err) {
                        console.warn('Largest files error:', err);
                        largestFiles = [];
                      }

                      // Folders with most files
                      db.all(`
                        SELECT 
                          folders.path,
                          folders.name,
                          COUNT(files.id) as file_count,
                          SUM(files.size) as total_size
                        FROM folders
                        LEFT JOIN files ON folders.id = files.folder_id
                        GROUP BY folders.id, folders.path, folders.name
                        HAVING file_count > 0
                        ORDER BY file_count DESC
                        LIMIT 10
                      `, (err, busiestFolders) => {
                        if (err) {
                          console.warn('Busiest folders error:', err);
                          busiestFolders = [];
                        }

                        // Date-based statistics
                        db.all(`
                          SELECT 
                            DATE(modified_at) as date,
                            COUNT(*) as files_modified
                          FROM files
                          WHERE modified_at IS NOT NULL 
                            AND DATE(modified_at) >= DATE('now', '-30 days')
                          GROUP BY DATE(modified_at)
                          ORDER BY date DESC
                          LIMIT 30
                        `, (err, dateStats) => {
                          if (err) {
                            console.warn('Date stats error:', err);
                            dateStats = [];
                          }

                          // Send final response
                          res.json({
                            summary: {
                              totalFolders: folderCount.count,
                              totalFiles: fileCount.count,
                              totalSize: totalSize.total || 0,
                              averageFileSize: fileCount.count > 0 ? (totalSize.total || 0) / fileCount.count : 0,
                              lastFolderScan: recentScans.last_folder_scan,
                              lastFileScan: recentFileScans.last_file_scan
                            },
                            fileTypes: fileTypes || [],
                            folderDepths: folderDepths || [],
                            sizeDistribution: sizeDistribution || [],
                            largestFiles: largestFiles || [],
                            busiestFolders: busiestFolders || [],
                            recentActivity: dateStats || []
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Could not get statistics', details: error.message });
  }
});

// Get detailed statistics for a specific path
router.get('/path', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { path: folderPath } = req.query;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    // Folder info
    db.get('SELECT * FROM folders WHERE path = ?', [folderPath], (err, folderInfo) => {
      if (err) {
        return res.status(500).json({ error: 'Could not get folder info' });
      }

      if (!folderInfo) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      // Files in this folder
      db.get(`
        SELECT 
          COUNT(*) as file_count,
          SUM(size) as total_size,
          AVG(size) as avg_size,
          MIN(size) as min_size,
          MAX(size) as max_size
        FROM files 
        WHERE folder_id = ?
      `, [folderInfo.id], (err, fileStats) => {
        if (err) {
          return res.status(500).json({ error: 'Could not get file stats' });
        }

        // File types in this folder
        db.all(`
          SELECT 
            extension,
            COUNT(*) as count,
            SUM(size) as total_size
          FROM files 
          WHERE folder_id = ? AND extension IS NOT NULL AND extension != ''
          GROUP BY extension 
          ORDER BY count DESC
        `, [folderInfo.id], (err, fileTypes) => {
          if (err) {
            console.warn('File types error:', err);
            fileTypes = [];
          }

          // Subfolders
          db.get(`
            SELECT 
              COUNT(*) as subfolder_count
            FROM folders 
            WHERE parent_path = ?
          `, [folderPath], (err, subfolderStats) => {
            if (err) {
              console.warn('Subfolder stats error:', err);
              subfolderStats = { subfolder_count: 0 };
            }

            res.json({
              folder: folderInfo,
              files: fileStats,
              fileTypes: fileTypes || [],
              subfolders: subfolderStats
            });
          });
        });
      });
    });

  } catch (error) {
    console.error('Path stats error:', error);
    res.status(500).json({ error: 'Could not get path statistics', details: error.message });
  }
});

// Export data to CSV format
router.get('/export', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { type = 'files', format = 'csv' } = req.query;

    if (format !== 'csv') {
      return res.status(400).json({ error: 'Only CSV format is currently supported' });
    }

    let query = '';
    let filename = '';

    if (type === 'folders') {
      query = `
        SELECT path, name, level, created_at, modified_at, accessed_at, scanned_at
        FROM folders 
        ORDER BY path
      `;
      filename = 'folders.csv';
    } else if (type === 'files') {
      query = `
        SELECT 
          folders.path as folder_path,
          f.name,
          f.extension,
          f.size,
          f.created_at,
          f.modified_at,
          f.accessed_at,
          f.scanned_at
        FROM files f
        LEFT JOIN folders ON f.folder_id = folders.id
        ORDER BY folders.path, f.name
      `;
      filename = 'files.csv';
    } else {
      return res.status(400).json({ error: 'Invalid type. Use "files" or "folders"' });
    }

    db.all(query, (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Export query failed', details: err.message });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'No data to export' });
      }

      // Convert to CSV with UTF-8 BOM for proper Excel font support
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
          }).join(',')
        )
      ].join('\n');

      // Add UTF-8 BOM for proper Excel font rendering
      const BOM = '\ufeff';
      const csvWithBOM = BOM + csvContent;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.send(csvWithBOM);
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

module.exports = router;
