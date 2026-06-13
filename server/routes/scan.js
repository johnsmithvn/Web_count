const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const router = express.Router();

// ─── Promise wrappers for callback-based sqlite3 ───
const dbRunAsync = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // `this` contains lastID, changes
    });
  });

const dbGetAsync = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAllAsync = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

// ─── Scan folders only (mode 1) ───
router.post('/folder', async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;

  try {
    const { rootPath, maxDepth = 10 } = req.body;

    if (!rootPath || !fs.existsSync(rootPath)) {
      return res.status(400).json({ error: 'Invalid root path' });
    }

    console.log(`Starting folder scan for user ${userId}: ${rootPath}`);

    // Step 1: Clear existing data (sequential, awaited)
    await dbRunAsync(db, 'DELETE FROM folders WHERE user_id = ? AND path LIKE ?', [userId, `${rootPath}%`]);

    // Step 2: Scan filesystem and insert folders
    let scannedCount = 0;

    const scanDirectory = async (dirPath, level = 0) => {
      if (level > maxDepth) return;

      try {
        const stats = fs.statSync(dirPath);
        const parentPath = path.dirname(dirPath);
        const name = path.basename(dirPath);

        await dbRunAsync(db, `
          INSERT OR REPLACE INTO folders 
          (user_id, path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          userId,
          dirPath,
          name,
          parentPath !== dirPath ? parentPath : null,
          level,
          stats.birthtime || stats.ctime,
          stats.mtime,
          stats.atime
        ]);

        scannedCount++;

        // Scan subdirectories
        try {
          const items = fs.readdirSync(dirPath);
          for (const item of items) {
            const itemPath = path.join(dirPath, item);
            try {
              const itemStats = fs.statSync(itemPath);
              if (itemStats.isDirectory()) {
                await scanDirectory(itemPath, level + 1);
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
    };

    await scanDirectory(rootPath);

    // Step 3: Record scan history
    await dbRunAsync(db, `
      INSERT INTO scans (user_id, root_path, status, folders_count, files_count, scan_options, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [userId, rootPath, 'completed', scannedCount, 0, JSON.stringify({ maxDepth })]);

    console.log(`Folder scan completed for user ${userId}. Scanned ${scannedCount} folders.`);

    // Step 4: Response (only after everything is done)
    res.json({
      success: true,
      message: `Folder scan completed`,
      scannedCount,
      rootPath
    });

  } catch (error) {
    console.error('Folder scan error:', error);
    res.status(500).json({ error: 'Folder scan failed', details: error.message });
  }
});

// ─── Scan files with metadata (mode 2) ───
router.post('/file', async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;

  try {
    const { rootPath, maxDepth = 10, includeExtensions = [], excludeExtensions = [] } = req.body;

    if (!rootPath || !fs.existsSync(rootPath)) {
      return res.status(400).json({ error: 'Invalid root path' });
    }

    console.log(`Starting file scan for user ${userId}: ${rootPath}`);
    console.log(`Include extensions: ${includeExtensions.length > 0 ? includeExtensions.join(', ') : 'All'}`);
    console.log(`Exclude extensions: ${excludeExtensions.length > 0 ? excludeExtensions.join(', ') : 'None'}`);

    // Step 1: Clear existing data (sequential, awaited)
    await dbRunAsync(db, `
      DELETE FROM files WHERE folder_id IN (
        SELECT id FROM folders WHERE user_id = ? AND path LIKE ?
      )
    `, [userId, `${rootPath}%`]);

    await dbRunAsync(db, 'DELETE FROM folders WHERE user_id = ? AND path LIKE ?', [userId, `${rootPath}%`]);

    // Step 2: Scan filesystem
    let scannedFolders = 0;
    let scannedFiles = 0;

    const scanDirectory = async (dirPath, level = 0) => {
      if (level > maxDepth) return;

      try {
        const stats = fs.statSync(dirPath);
        const parentPath = path.dirname(dirPath);
        const name = path.basename(dirPath);

        // Insert folder record
        await dbRunAsync(db, `
          INSERT OR REPLACE INTO folders 
          (user_id, path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          userId,
          dirPath,
          name,
          parentPath !== dirPath ? parentPath : null,
          level,
          stats.birthtime || stats.ctime,
          stats.mtime,
          stats.atime
        ]);

        scannedFolders++;

        // Get folder ID for file associations
        const row = await dbGetAsync(db, 'SELECT id FROM folders WHERE user_id = ? AND path = ?', [userId, dirPath]);
        if (!row?.id) {
          console.warn(`Could not get folder ID for ${dirPath}`);
          return;
        }
        const folderId = row.id;

        // Scan directory contents
        try {
          const items = fs.readdirSync(dirPath);

          for (const item of items) {
            const itemPath = path.join(dirPath, item);
            try {
              const itemStats = fs.statSync(itemPath);

              if (itemStats.isDirectory()) {
                await scanDirectory(itemPath, level + 1);
              } else if (itemStats.isFile()) {
                const extension = path.extname(item).toLowerCase();

                // Filter by extensions if specified
                const shouldInclude = includeExtensions.length === 0 || includeExtensions.includes(extension);
                const shouldExclude = excludeExtensions.length > 0 && excludeExtensions.includes(extension);

                if (shouldInclude && !shouldExclude) {
                  await dbRunAsync(db, `
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
                  ]);

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
      } catch (error) {
        console.warn(`Warning: Could not scan ${dirPath}:`, error.message);
      }
    };

    await scanDirectory(rootPath);

    // Step 3: Record scan history
    await dbRunAsync(db, `
      INSERT INTO scans (user_id, root_path, status, folders_count, files_count, scan_options, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [userId, rootPath, 'completed', scannedFolders, scannedFiles, JSON.stringify({ maxDepth, includeExtensions, excludeExtensions })]);

    console.log(`File scan completed for user ${userId}. Scanned ${scannedFolders} folders and ${scannedFiles} files.`);

    // Step 4: Response (only after everything is done)
    res.json({
      success: true,
      message: `File scan completed`,
      scannedFolders,
      scannedFiles,
      rootPath
    });

  } catch (error) {
    console.error('File scan error:', error);
    res.status(500).json({ error: 'File scan failed', details: error.message });
  }
});

// ─── Get scan status ───
router.get('/status', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;

  try {
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

        db.get(`
          SELECT MAX(scanned_at) as last_scan 
          FROM (
            SELECT scanned_at FROM folders WHERE user_id = ?
            UNION ALL 
            SELECT f.scanned_at 
            FROM files f
            JOIN folders ON f.folder_id = folders.id
            WHERE folders.user_id = ?
          )
        `, [userId, userId], (err, lastScan) => {
          if (err) {
            return res.status(500).json({ error: 'Could not get last scan' });
          }

          // Get recent scans — fixed: scan_type → scan_options
          db.all(`
            SELECT root_path, status, folders_count, files_count, scan_options, created_at, completed_at
            FROM scans 
            WHERE user_id = ?
            ORDER BY created_at DESC 
            LIMIT 5
          `, [userId], (err, recentScans) => {
            if (err) {
              console.error('Error getting recent scans:', err);
            }

            res.json({
              folders: folderCount.count,
              files: fileCount.count,
              lastScan: lastScan.last_scan,
              recentScans: recentScans || []
            });
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
