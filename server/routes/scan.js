const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const router = express.Router();

// Scan folders only (mode 1)
router.post('/folder', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { rootPath, maxDepth = 10 } = req.body;
    
    if (!rootPath || !fs.existsSync(rootPath)) {
      return res.status(400).json({ error: 'Invalid root path' });
    }

    console.log(`Starting folder scan: ${rootPath}`);
    
    // Clear existing data for this root path
    db.run('DELETE FROM folders WHERE path LIKE ?', [`${rootPath}%`], (err) => {
      if (err) console.error('Error clearing folders:', err);
    });

    let scannedCount = 0;

    function scanDirectory(dirPath, level = 0) {
      if (level > maxDepth) return;

      try {
        const stats = fs.statSync(dirPath);
        const parentPath = path.dirname(dirPath);
        const name = path.basename(dirPath);

        // Insert folder record
        db.run(`
          INSERT OR REPLACE INTO folders 
          (path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          dirPath,
          name,
          parentPath !== dirPath ? parentPath : null,
          level,
          stats.birthtime || stats.ctime,
          stats.mtime,
          stats.atime
        ], (err) => {
          if (err) console.error('Error inserting folder:', err);
        });

        scannedCount++;

        // Scan subdirectories
        try {
          const items = fs.readdirSync(dirPath);
          for (const item of items) {
            const itemPath = path.join(dirPath, item);
            try {
              const itemStats = fs.statSync(itemPath);
              if (itemStats.isDirectory()) {
                scanDirectory(itemPath, level + 1);
              }
            } catch (itemError) {
              console.warn(`Warning: Could not stat ${itemPath}:`, itemError.message);
            }
          }
        } catch (readError) {
          console.warn(`Warning: Could not read directory ${dirPath}:`, readError.message);
        }
      } catch (error) {
        console.warn(`Warning: Could not scan ${dirPath}:`, error.message);
      }
    }

    // Start scanning
    scanDirectory(rootPath);

    // Wait a bit for async operations to complete
    setTimeout(() => {
      console.log(`Folder scan completed. Scanned ${scannedCount} folders.`);
      
      res.json({
        success: true,
        message: `Folder scan completed`,
        scannedCount,
        rootPath
      });
    }, 1000);

  } catch (error) {
    console.error('Folder scan error:', error);
    res.status(500).json({ error: 'Folder scan failed', details: error.message });
  }
});

// Scan files with metadata (mode 2)
router.post('/file', async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { rootPath, maxDepth = 10, includeExtensions = [], excludeExtensions = [] } = req.body;
    
    if (!rootPath || !fs.existsSync(rootPath)) {
      return res.status(400).json({ error: 'Invalid root path' });
    }

    console.log(`Starting file scan: ${rootPath}`);
    console.log(`Include extensions: ${includeExtensions.length > 0 ? includeExtensions.join(', ') : 'All'}`);
    console.log(`Exclude extensions: ${excludeExtensions.length > 0 ? excludeExtensions.join(', ') : 'None'}`);
    
    // Clear existing data for this root path
    db.run(`
      DELETE FROM files WHERE folder_id IN (
        SELECT id FROM folders WHERE path LIKE ?
      )
    `, [`${rootPath}%`], (err) => {
      if (err) console.error('Error clearing files:', err);
    });
    
    db.run('DELETE FROM folders WHERE path LIKE ?', [`${rootPath}%`], (err) => {
      if (err) console.error('Error clearing folders:', err);
    });

    let scannedFolders = 0;
    let scannedFiles = 0;

    function scanDirectory(dirPath, level = 0) {
      if (level > maxDepth) return;

      try {
        const stats = fs.statSync(dirPath);
        const parentPath = path.dirname(dirPath);
        const name = path.basename(dirPath);

        // Insert folder record
        db.run(`
          INSERT OR REPLACE INTO folders 
          (path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          dirPath,
          name,
          parentPath !== dirPath ? parentPath : null,
          level,
          stats.birthtime || stats.ctime,
          stats.mtime,
          stats.atime
        ], (err) => {
          if (err) {
            console.error('Error inserting folder:', err);
            return;
          }

          scannedFolders++;

          // Get folder ID for file associations
          db.get('SELECT id FROM folders WHERE path = ?', [dirPath], (err, row) => {
            if (err) {
              console.error('Error getting folder ID:', err);
              return;
            }

            const folderId = row?.id;
            if (!folderId) {
              console.warn(`Could not get folder ID for ${dirPath}`);
              return;
            }

            // Scan directory contents
            try {
              const items = fs.readdirSync(dirPath);
              
              for (const item of items) {
                const itemPath = path.join(dirPath, item);
                try {
                  const itemStats = fs.statSync(itemPath);
                  
                  if (itemStats.isDirectory()) {
                    // Recursively scan subdirectories
                    scanDirectory(itemPath, level + 1);
                  } else if (itemStats.isFile()) {
                    // Process file
                    const extension = path.extname(item).toLowerCase();
                    
                    // Filter by extensions if specified
                    const shouldInclude = includeExtensions.length === 0 || includeExtensions.includes(extension);
                    const shouldExclude = excludeExtensions.length > 0 && excludeExtensions.includes(extension);
                    
                    if (shouldInclude && !shouldExclude) {
                      db.run(`
                        INSERT INTO files 
                        (folder_id, name, extension, size, created_at, modified_at, accessed_at, scanned_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                      `, [
                        folderId,
                        item,
                        extension,
                        itemStats.size,
                        itemStats.birthtime || itemStats.ctime,
                        itemStats.mtime,
                        itemStats.atime
                      ], (err) => {
                        if (err) console.error('Error inserting file:', err);
                      });
                      
                      scannedFiles++;
                    }
                  }
                } catch (itemError) {
                  console.warn(`Warning: Could not stat ${itemPath}:`, itemError.message);
                }
              }
            } catch (readError) {
              console.warn(`Warning: Could not read directory ${dirPath}:`, readError.message);
            }
          });
        });
      } catch (error) {
        console.warn(`Warning: Could not scan ${dirPath}:`, error.message);
      }
    }

    // Start scanning
    scanDirectory(rootPath);

    // Wait for async operations to complete
    setTimeout(() => {
      console.log(`File scan completed. Scanned ${scannedFolders} folders and ${scannedFiles} files.`);
      
      res.json({
        success: true,
        message: `File scan completed`,
        scannedFolders,
        scannedFiles,
        rootPath
      });
    }, 2000);

  } catch (error) {
    console.error('File scan error:', error);
    res.status(500).json({ error: 'File scan failed', details: error.message });
  }
});

// Get scan status
router.get('/status', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    db.get('SELECT COUNT(*) as count FROM folders', (err, folderCount) => {
      if (err) {
        return res.status(500).json({ error: 'Could not get folder count' });
      }

      db.get('SELECT COUNT(*) as count FROM files', (err, fileCount) => {
        if (err) {
          return res.status(500).json({ error: 'Could not get file count' });
        }

        db.get(`
          SELECT MAX(scanned_at) as last_scan 
          FROM (
            SELECT scanned_at FROM folders 
            UNION ALL 
            SELECT scanned_at FROM files
          )
        `, (err, lastScan) => {
          if (err) {
            return res.status(500).json({ error: 'Could not get last scan' });
          }

          res.json({
            folders: folderCount.count,
            files: fileCount.count,
            lastScan: lastScan.last_scan
          });
        });
      });
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Could not get scan status' });
  }
});

module.exports = router;
