const express = require('express');

const router = express.Router();

// Get database statistics
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;
  
  try {
    // Basic counts for current user
    db.get('SELECT COUNT(*) as count FROM folders WHERE user_id = ?', [userId], (err, folderCount) => {
      if (err) {
        return res.status(500).json({ error: 'Could not get folder count' });
      }

      db.get(`
        SELECT COUNT(*) as count 
        FROM files f
        JOIN folders ON f.folder_id = folders.id
        WHERE folders.user_id = ?
      `, [userId], (err, fileCount) => {
        if (err) {
          return res.status(500).json({ error: 'Could not get file count' });
        }

        // Total size for current user
        db.get(`
          SELECT SUM(f.size) as total 
          FROM files f
          JOIN folders ON f.folder_id = folders.id
          WHERE folders.user_id = ?
        `, [userId], (err, totalSize) => {
          if (err) {
            return res.status(500).json({ error: 'Could not get total size' });
          }

          // File type distribution for current user
          db.all(`
            SELECT 
              f.extension,
              COUNT(*) as count,
              SUM(f.size) as total_size,
              AVG(f.size) as avg_size
            FROM files f
            JOIN folders ON f.folder_id = folders.id
            WHERE folders.user_id = ? AND f.extension IS NOT NULL AND f.extension != ''
            GROUP BY f.extension 
            ORDER BY count DESC
            LIMIT 20
          `, [userId], (err, fileTypes) => {
            if (err) {
              console.warn('File types error:', err);
              fileTypes = [];
            }

            // Folder depth distribution for current user
            db.all(`
              SELECT 
                level,
                COUNT(*) as count
              FROM folders 
              WHERE user_id = ?
              GROUP BY level 
              ORDER BY level
            `, [userId], (err, folderDepths) => {
              if (err) {
                console.warn('Folder depths error:', err);
                folderDepths = [];
              }

              // Recent scans for current user
              db.get('SELECT MAX(scanned_at) as last_folder_scan FROM folders WHERE user_id = ?', [userId], (err, recentScans) => {
                if (err) {
                  console.warn('Recent scans error:', err);
                  recentScans = { last_folder_scan: null };
                }

                db.get(`
                  SELECT MAX(f.scanned_at) as last_file_scan 
                  FROM files f
                  JOIN folders ON f.folder_id = folders.id
                  WHERE folders.user_id = ?
                `, [userId], (err, recentFileScans) => {
                  if (err) {
                    console.warn('Recent file scans error:', err);
                    recentFileScans = { last_file_scan: null };
                  }

                  // Size distribution for current user
                  db.all(`
                    SELECT 
                      CASE 
                        WHEN f.size < 1024 THEN 'Under 1KB'
                        WHEN f.size < 1048576 THEN '1KB - 1MB'
                        WHEN f.size < 104857600 THEN '1MB - 100MB'
                        WHEN f.size < 1073741824 THEN '100MB - 1GB'
                        ELSE 'Over 1GB'
                      END as size_range,
                      COUNT(*) as count,
                      SUM(f.size) as total_size
                    FROM files f
                    JOIN folders ON f.folder_id = folders.id
                    WHERE folders.user_id = ?
                    GROUP BY size_range
                    ORDER BY 
                      CASE size_range
                        WHEN 'Under 1KB' THEN 1
                        WHEN '1KB - 1MB' THEN 2
                        WHEN '1MB - 100MB' THEN 3
                        WHEN '100MB - 1GB' THEN 4
                        WHEN 'Over 1GB' THEN 5
                      END
                  `, [userId], (err, sizeDistribution) => {
                    if (err) {
                      console.warn('Size distribution error:', err);
                      sizeDistribution = [];
                    }

                    // Top 10 largest files for current user
                    db.all(`
                      SELECT 
                        f.name,
                        f.extension,
                        f.size,
                        folders.path as folder_path
                      FROM files f
                      JOIN folders ON f.folder_id = folders.id
                      WHERE folders.user_id = ?
                      ORDER BY f.size DESC
                      LIMIT 10
                    `, [userId], (err, largestFiles) => {
                      if (err) {
                        console.warn('Largest files error:', err);
                        largestFiles = [];
                      }

                      // Folders with most files for current user
                      db.all(`
                        SELECT 
                          folders.path,
                          folders.name,
                          COUNT(files.id) as file_count,
                          SUM(files.size) as total_size
                        FROM folders
                        LEFT JOIN files ON folders.id = files.folder_id
                        WHERE folders.user_id = ?
                        GROUP BY folders.id, folders.path, folders.name
                        HAVING file_count > 0
                        ORDER BY file_count DESC
                        LIMIT 10
                      `, [userId], (err, busiestFolders) => {
                        if (err) {
                          console.warn('Busiest folders error:', err);
                          busiestFolders = [];
                        }

                        // Date-based statistics for current user
                        db.all(`
                          SELECT 
                            DATE(f.modified_at) as date,
                            COUNT(*) as files_modified
                          FROM files f
                          JOIN folders ON f.folder_id = folders.id
                          WHERE folders.user_id = ? AND f.modified_at IS NOT NULL 
                            AND DATE(f.modified_at) >= DATE('now', '-30 days')
                          GROUP BY DATE(f.modified_at)
                          ORDER BY date DESC
                          LIMIT 30
                        `, [userId], (err, dateStats) => {
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

// Get latest scan information for each root path
router.get('/root-paths', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;

  try {
    const query = `
      SELECT
        s.id,
        s.root_path,
        s.status,
        s.folders_count,
        s.files_count,
        s.created_at,
        s.completed_at,
        (
          SELECT COUNT(*)
          FROM scans
          WHERE user_id = s.user_id AND root_path = s.root_path
        ) AS scan_count
      FROM scans s
      WHERE s.user_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM scans newer
          WHERE newer.user_id = s.user_id
            AND newer.root_path = s.root_path
            AND (
              newer.created_at > s.created_at OR
              (newer.created_at = s.created_at AND newer.id > s.id)
            )
        )
      ORDER BY s.created_at DESC, s.id DESC
    `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error('Root paths query failed:', err);
        return res.status(500).json({ error: 'Could not get root paths' });
      }

      const rootPaths = (rows || []).map((row) => ({
        id: row.id,
        rootPath: row.root_path,
        status: row.status,
        foldersCount: row.folders_count,
        filesCount: row.files_count,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        scanCount: row.scan_count
      }));

      res.json({ rootPaths });
    });
  } catch (error) {
    console.error('Root paths error:', error);
    res.status(500).json({ error: 'Could not get root paths', details: error.message });
  }
});

// Get detailed scan history for a specific root path
router.get('/root-paths/:encodedRootPath', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;

  try {
    const rootPath = decodeURIComponent(req.params.encodedRootPath || '');

    if (!rootPath) {
      return res.status(400).json({ error: 'Root path parameter is required' });
    }

    const historyQuery = `
      SELECT
        id,
        status,
        folders_count,
        files_count,
        created_at,
        completed_at,
        scan_options
      FROM scans
      WHERE user_id = ? AND root_path = ?
      ORDER BY created_at DESC, id DESC
    `;

    db.all(historyQuery, [userId, rootPath], (err, rows) => {
      if (err) {
        console.error('Root path history failed:', err);
        return res.status(500).json({ error: 'Could not get root path history' });
      }

      const scans = (rows || []).map((row) => {
        let scanOptions = null;
        if (row.scan_options) {
          try {
            scanOptions = JSON.parse(row.scan_options);
          } catch (parseError) {
            scanOptions = row.scan_options;
          }
        }

        return {
          id: row.id,
          status: row.status,
          foldersCount: row.folders_count,
          filesCount: row.files_count,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          scanOptions
        };
      });

      db.get(
        `
          SELECT COUNT(*) as folderCount
          FROM folders
          WHERE user_id = ? AND path LIKE ?
        `,
        [userId, `${rootPath}%`],
        (folderErr, folderStats) => {
          if (folderErr) {
            console.error('Folder stats failed:', folderErr);
            return res.status(500).json({ error: 'Could not get folder statistics' });
          }

          db.get(
            `
              SELECT
                COUNT(*) as fileCount,
                SUM(f.size) as totalSize
              FROM files f
              JOIN folders ON f.folder_id = folders.id
              WHERE folders.user_id = ? AND folders.path LIKE ?
            `,
            [userId, `${rootPath}%`],
            (fileErr, fileStats) => {
              if (fileErr) {
                console.error('File stats failed:', fileErr);
                return res.status(500).json({ error: 'Could not get file statistics' });
              }

              res.json({
                rootPath,
                scans,
                totals: {
                  scanCount: scans.length,
                  latestScan: scans[0]?.createdAt || null,
                  latestCompletion: scans[0]?.completedAt || null
                },
                currentData: {
                  folderCount: folderStats?.folderCount || 0,
                  fileCount: fileStats?.fileCount || 0,
                  totalSize: fileStats?.totalSize || 0
                }
              });
            }
          );
        }
      );
    });
  } catch (error) {
    console.error('Root path detail error:', error);
    res.status(500).json({ error: 'Could not get root path detail', details: error.message });
  }
});

// Get detailed statistics for a specific path
router.get('/path', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;
  
  try {
    const { path: folderPath } = req.query;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    // Folder info for current user
    db.get('SELECT * FROM folders WHERE user_id = ? AND path = ?', [userId, folderPath], (err, folderInfo) => {
      if (err) {
        return res.status(500).json({ error: 'Could not get folder info' });
      }

      if (!folderInfo) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      // Files in this folder for current user
      db.get(`
        SELECT 
          COUNT(*) as file_count,
          SUM(f.size) as total_size,
          AVG(f.size) as avg_size,
          MIN(f.size) as min_size,
          MAX(f.size) as max_size
        FROM files f
        JOIN folders ON f.folder_id = folders.id
        WHERE folders.user_id = ? AND f.folder_id = ?
      `, [userId, folderInfo.id], (err, fileStats) => {
        if (err) {
          return res.status(500).json({ error: 'Could not get file stats' });
        }

        // File types in this folder for current user
        db.all(`
          SELECT 
            f.extension,
            COUNT(*) as count,
            SUM(f.size) as total_size
          FROM files f
          JOIN folders ON f.folder_id = folders.id
          WHERE folders.user_id = ? AND f.folder_id = ? AND f.extension IS NOT NULL AND f.extension != ''
          GROUP BY f.extension 
          ORDER BY count DESC
        `, [userId, folderInfo.id], (err, fileTypes) => {
          if (err) {
            console.warn('File types error:', err);
            fileTypes = [];
          }

          // Subfolders for current user
          db.get(`
            SELECT 
              COUNT(*) as subfolder_count
            FROM folders 
            WHERE user_id = ? AND parent_path = ?
          `, [userId, folderPath], (err, subfolderStats) => {
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
  const userId = req.userId;
  
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
        WHERE user_id = ?
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
        JOIN folders ON f.folder_id = folders.id
        WHERE folders.user_id = ?
        ORDER BY folders.path, f.name
      `;
      filename = 'files.csv';
    } else {
      return res.status(400).json({ error: 'Invalid type. Use "files" or "folders"' });
    }

    db.all(query, [userId], (err, data) => {
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
