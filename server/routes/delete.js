const express = require('express');

const router = express.Router();

// Delete individual file by ID
router.delete('/file/:id', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;
  
  try {
    const fileId = req.params.id;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    console.log(`Deleting file with ID: ${fileId} for user ${userId}`);

    // Get file info before deletion for logging (only user's files)
    db.get(`
      SELECT f.name, f.folder_id 
      FROM files f
      JOIN folders ON f.folder_id = folders.id
      WHERE f.id = ? AND folders.user_id = ?
    `, [fileId, userId], (err, fileInfo) => {
      if (err) {
        console.error('Error getting file info:', err);
        return res.status(500).json({ error: 'Failed to get file info' });
      }

      if (!fileInfo) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete the file (only user's files)
      db.run(`
        DELETE FROM files 
        WHERE id = ? AND folder_id IN (
          SELECT id FROM folders WHERE user_id = ?
        )
      `, [fileId, userId], function(err) {
        if (err) {
          console.error('Error deleting file:', err);
          return res.status(500).json({ error: 'Failed to delete file' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'File not found' });
        }

        console.log(`Successfully deleted file: ${fileInfo.name}`);
        
        res.json({
          success: true,
          message: `File "${fileInfo.name}" deleted successfully`,
          fileId: fileId,
          fileName: fileInfo.name
        });
      });
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Delete file failed', details: error.message });
  }
});

// Delete data by root path
router.delete('/', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;
  
  try {
    const { rootPath, deleteType = 'both' } = req.body;
    
    if (!rootPath) {
      return res.status(400).json({ error: 'Root path is required' });
    }

    console.log(`Starting delete operation for user ${userId}: ${rootPath} (type: ${deleteType})`);
    
    let deletedFolders = 0;
    let deletedFiles = 0;
    let deletedScans = 0;

    // Validate deleteType
    if (!['folders', 'files', 'both'].includes(deleteType)) {
      return res.status(400).json({ 
        error: 'Invalid delete type. Use: folders, files, or both' 
      });
    }

    // Function to execute deletions
    const executeDeletes = () => {
      const promises = [];

      // Delete files if needed (only user's files)
      if (deleteType === 'files' || deleteType === 'both') {
        promises.push(new Promise((resolve, reject) => {
          // First get count of files to be deleted for current user
          db.get(`
            SELECT COUNT(*) as count 
            FROM files f
            JOIN folders ON f.folder_id = folders.id
            WHERE folders.user_id = ? AND folders.path LIKE ?
          `, [userId, `${rootPath}%`], (err, countResult) => {
            if (err) {
              console.error('Error counting files:', err);
              reject(err);
              return;
            }

            const fileCount = countResult?.count || 0;
            
            // Delete files for current user
            db.run(`
              DELETE FROM files 
              WHERE folder_id IN (
                SELECT id FROM folders WHERE user_id = ? AND path LIKE ?
              )
            `, [userId, `${rootPath}%`], function(err) {
              if (err) {
                console.error('Error deleting files:', err);
                reject(err);
              } else {
                deletedFiles = fileCount;
                console.log(`Deleted ${deletedFiles} files`);
                resolve();
              }
            });
          });
        }));
      }

      // Delete folders if needed (only user's folders)
      if (deleteType === 'folders' || deleteType === 'both') {
        promises.push(new Promise((resolve, reject) => {
          // First get count of folders to be deleted for current user
          db.get(`
            SELECT COUNT(*) as count 
            FROM folders 
            WHERE user_id = ? AND path LIKE ?
          `, [userId, `${rootPath}%`], (err, countResult) => {
            if (err) {
              console.error('Error counting folders:', err);
              reject(err);
              return;
            }

            const folderCount = countResult?.count || 0;
            
            // Delete folders for current user
            db.run(`
              DELETE FROM folders 
              WHERE user_id = ? AND path LIKE ?
            `, [userId, `${rootPath}%`], function(err) {
              if (err) {
                console.error('Error deleting folders:', err);
                reject(err);
              } else {
                deletedFolders = folderCount;
                console.log(`Deleted ${deletedFolders} folders`);
                resolve();
              }
            });
          });
        }));
      }

      // Always delete scan history for this root path
      promises.push(new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND root_path = ?',
          [userId, rootPath],
          (scanCountErr, scanCountResult) => {
            if (scanCountErr) {
              console.error('Error counting scans:', scanCountErr);
              reject(scanCountErr);
              return;
            }

            const scanCount = scanCountResult?.count || 0;

            db.run(
              'DELETE FROM scans WHERE user_id = ? AND root_path = ?',
              [userId, rootPath],
              function(scanDeleteErr) {
                if (scanDeleteErr) {
                  console.error('Error deleting scans:', scanDeleteErr);
                  reject(scanDeleteErr);
                } else {
                  deletedScans = scanCount;
                  resolve();
                }
              }
            );
          }
        );
      }));

      // Execute all deletions
      Promise.all(promises)
        .then(() => {
          console.log(`Delete operation completed. Folders: ${deletedFolders}, Files: ${deletedFiles}`);

          res.json({
            success: true,
            message: `Delete operation completed`,
            deletedFolders,
            deletedFiles,
            deletedScans,
            rootPath,
            deleteType
          });
        })
        .catch((error) => {
          console.error('Delete operation failed:', error);
          res.status(500).json({ 
            error: 'Delete operation failed', 
            details: error.message 
          });
        });
    };

    // Execute the deletion
    executeDeletes();

  } catch (error) {
    console.error('Delete endpoint error:', error);
    res.status(500).json({ error: 'Delete operation failed', details: error.message });
  }
});

// Delete all data for current user (clear user's database)
router.delete('/all', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.userId;
  
  try {
    console.log(`Starting complete database clear for user ${userId}...`);

    // Delete all user's files first (due to foreign key constraint)
    db.run(`
      DELETE FROM files 
      WHERE folder_id IN (
        SELECT id FROM folders WHERE user_id = ?
      )
    `, [userId], (err) => {
      if (err) {
        console.error('Error deleting all user files:', err);
        return res.status(500).json({ error: 'Failed to delete files' });
      }

      // Then delete all user's folders
      db.run('DELETE FROM folders WHERE user_id = ?', [userId], (err) => {
        if (err) {
          console.error('Error deleting all user folders:', err);
          return res.status(500).json({ error: 'Failed to delete folders' });
        }

        // Delete user's scan history
        db.run('DELETE FROM scans WHERE user_id = ?', [userId], (err) => {
          if (err) {
            console.error('Error deleting user scan history:', err);
            // Continue anyway, this is not critical
          }

          console.log(`Database cleared successfully for user ${userId}`);
          
          res.json({
            success: true,
            message: 'All your data cleared from database',
            deletedFolders: 'all',
            deletedFiles: 'all'
          });
        });
      });
    });

  } catch (error) {
    console.error('Clear all error:', error);
    res.status(500).json({ error: 'Failed to clear database', details: error.message });
  }
});

// Get deletion preview (count what would be deleted)
router.post('/preview', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { rootPath, deleteType = 'both' } = req.body;
    const userId = req.userId;
    
    if (!rootPath) {
      return res.status(400).json({ error: 'Root path is required' });
    }

    if (!['folders', 'files', 'both'].includes(deleteType)) {
      return res.status(400).json({ 
        error: 'Invalid delete type. Use: folders, files, or both' 
      });
    }

    let folderCount = 0;
    let fileCount = 0;
    let completed = 0;
    const total = (deleteType === 'both') ? 2 : 1;

    const sendResponse = () => {
      if (completed === total) {
        res.json({
          rootPath,
          deleteType,
          preview: {
            foldersToDelete: folderCount,
            filesToDelete: fileCount,
            totalItems: folderCount + fileCount
          }
        });
      }
    };

    // Count folders if needed
    if (deleteType === 'folders' || deleteType === 'both') {
      db.get(`
        SELECT COUNT(*) as count 
        FROM folders 
        WHERE path LIKE ? AND user_id = ?
      `, [`${rootPath}%`, userId], (err, result) => {
        if (err) {
          console.error('Error counting folders for preview:', err);
        } else {
          folderCount = result?.count || 0;
        }
        completed++;
        sendResponse();
      });
    }

    // Count files if needed
    if (deleteType === 'files' || deleteType === 'both') {
      db.get(`
        SELECT COUNT(*) as count 
        FROM files 
        WHERE folder_id IN (
          SELECT id FROM folders WHERE path LIKE ? AND user_id = ?
        )
      `, [`${rootPath}%`, userId], (err, result) => {
        if (err) {
          console.error('Error counting files for preview:', err);
        } else {
          fileCount = result?.count || 0;
        }
        completed++;
        sendResponse();
      });
    }

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Preview failed', details: error.message });
  }
});

module.exports = router;
