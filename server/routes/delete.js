const express = require('express');

const router = express.Router();

// Delete data by root path
router.delete('/', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const { rootPath, deleteType = 'both' } = req.body;
    
    if (!rootPath) {
      return res.status(400).json({ error: 'Root path is required' });
    }

    console.log(`Starting delete operation: ${rootPath} (type: ${deleteType})`);
    
    let deletedFolders = 0;
    let deletedFiles = 0;

    // Validate deleteType
    if (!['folders', 'files', 'both'].includes(deleteType)) {
      return res.status(400).json({ 
        error: 'Invalid delete type. Use: folders, files, or both' 
      });
    }

    // Function to execute deletions
    const executeDeletes = () => {
      const promises = [];

      // Delete files if needed
      if (deleteType === 'files' || deleteType === 'both') {
        promises.push(new Promise((resolve, reject) => {
          // First get count of files to be deleted
          db.get(`
            SELECT COUNT(*) as count 
            FROM files 
            WHERE folder_id IN (
              SELECT id FROM folders WHERE path LIKE ?
            )
          `, [`${rootPath}%`], (err, countResult) => {
            if (err) {
              console.error('Error counting files:', err);
              reject(err);
              return;
            }

            const fileCount = countResult?.count || 0;
            
            // Delete files
            db.run(`
              DELETE FROM files 
              WHERE folder_id IN (
                SELECT id FROM folders WHERE path LIKE ?
              )
            `, [`${rootPath}%`], function(err) {
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

      // Delete folders if needed
      if (deleteType === 'folders' || deleteType === 'both') {
        promises.push(new Promise((resolve, reject) => {
          // First get count of folders to be deleted
          db.get(`
            SELECT COUNT(*) as count 
            FROM folders 
            WHERE path LIKE ?
          `, [`${rootPath}%`], (err, countResult) => {
            if (err) {
              console.error('Error counting folders:', err);
              reject(err);
              return;
            }

            const folderCount = countResult?.count || 0;
            
            // Delete folders
            db.run(`
              DELETE FROM folders 
              WHERE path LIKE ?
            `, [`${rootPath}%`], function(err) {
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

      // Execute all deletions
      Promise.all(promises)
        .then(() => {
          console.log(`Delete operation completed. Folders: ${deletedFolders}, Files: ${deletedFiles}`);
          
          res.json({
            success: true,
            message: `Delete operation completed`,
            deletedFolders,
            deletedFiles,
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

// Delete all data (clear database)
router.delete('/all', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    console.log('Starting complete database clear...');

    // Delete all files first (due to foreign key constraint)
    db.run('DELETE FROM files', (err) => {
      if (err) {
        console.error('Error deleting all files:', err);
        return res.status(500).json({ error: 'Failed to delete files' });
      }

      // Then delete all folders
      db.run('DELETE FROM folders', (err) => {
        if (err) {
          console.error('Error deleting all folders:', err);
          return res.status(500).json({ error: 'Failed to delete folders' });
        }

        console.log('Database cleared successfully');
        
        res.json({
          success: true,
          message: 'All data cleared from database',
          deletedFolders: 'all',
          deletedFiles: 'all'
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
        WHERE path LIKE ?
      `, [`${rootPath}%`], (err, result) => {
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
          SELECT id FROM folders WHERE path LIKE ?
        )
      `, [`${rootPath}%`], (err, result) => {
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
