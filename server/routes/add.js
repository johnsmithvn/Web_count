const express = require('express');
const path = require('path');

const router = express.Router();

// Add new file to database
router.post('/file', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const {
      name,
      path: filePath,
      extension = '',
      size = 0,
      created_at,
      modified_at,
      accessed_at
    } = req.body;

    // Validate required fields
    if (!name || !filePath) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'Both name and path are required' 
      });
    }

    // Normalize path and extract folder path
    const normalizedPath = filePath.replace(/\\/g, '\\');
    const folderPath = normalizedPath;

    // Check if folder exists, if not create it
    db.get('SELECT id FROM folders WHERE path = ?', [folderPath], (err, folder) => {
      if (err) {
        console.error('Error checking folder:', err);
        return res.status(500).json({ error: 'Database error checking folder' });
      }

      let folderId = folder?.id;

      const insertFile = (folderId) => {
        const now = new Date().toISOString();
        const fileData = {
          name: name.trim(),
          extension: extension || (name.includes('.') ? name.substring(name.lastIndexOf('.')) : ''),
          size: parseInt(size) || 0,
          folder_id: folderId,
          created_at: created_at || now,
          modified_at: modified_at || now,
          accessed_at: accessed_at || now,
          scanned_at: now
        };

        const insertQuery = `
          INSERT INTO files (name, extension, size, folder_id, created_at, modified_at, accessed_at, scanned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(insertQuery, [
          fileData.name,
          fileData.extension,
          fileData.size,
          fileData.folder_id,
          fileData.created_at,
          fileData.modified_at,
          fileData.accessed_at,
          fileData.scanned_at
        ], function(err) {
          if (err) {
            console.error('Error inserting file:', err);
            return res.status(500).json({ error: 'Failed to add file', details: err.message });
          }

          res.json({
            success: true,
            message: `File "${name}" added successfully`,
            fileId: this.lastID,
            file: {
              id: this.lastID,
              ...fileData,
              folder_path: folderPath
            }
          });
        });
      };

      if (!folder) {
        // Create folder first
        const parentPath = path.dirname(folderPath);
        const folderName = path.basename(folderPath);
        const level = folderPath.split(path.sep).length - 1;
        
        const insertFolderQuery = `
          INSERT INTO folders (path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const now = new Date().toISOString();
        
        db.run(insertFolderQuery, [
          folderPath,
          folderName,
          parentPath,
          level,
          now,
          now,
          now,
          now
        ], function(err) {
          if (err) {
            console.error('Error creating folder:', err);
            return res.status(500).json({ error: 'Failed to create folder', details: err.message });
          }

          insertFile(this.lastID);
        });
      } else {
        insertFile(folderId);
      }
    });

  } catch (error) {
    console.error('Add file error:', error);
    res.status(500).json({ error: 'Failed to add file', details: error.message });
  }
});

// Add new folder to database
router.post('/folder', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const {
      path: folderPath,
      name
    } = req.body;

    // Validate required fields
    if (!folderPath) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'Path is required' 
      });
    }

    // Normalize path
    const normalizedPath = folderPath.replace(/\\/g, '\\');
    const folderName = name || path.basename(normalizedPath);
    const parentPath = path.dirname(normalizedPath);
    const level = normalizedPath.split(path.sep).length - 1;

    // Check if folder already exists
    db.get('SELECT id FROM folders WHERE path = ?', [normalizedPath], (err, existing) => {
      if (err) {
        console.error('Error checking folder:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        return res.status(409).json({ 
          error: 'Folder already exists', 
          details: `Folder "${normalizedPath}" is already in database` 
        });
      }

      const now = new Date().toISOString();
      const insertQuery = `
        INSERT INTO folders (path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(insertQuery, [
        normalizedPath,
        folderName,
        parentPath,
        level,
        now,
        now,
        now,
        now
      ], function(err) {
        if (err) {
          console.error('Error inserting folder:', err);
          return res.status(500).json({ error: 'Failed to add folder', details: err.message });
        }

        res.json({
          success: true,
          message: `Folder "${folderName}" added successfully`,
          folderId: this.lastID,
          folder: {
            id: this.lastID,
            path: normalizedPath,
            name: folderName,
            parent_path: parentPath,
            level,
            created_at: now,
            modified_at: now,
            accessed_at: now,
            scanned_at: now
          }
        });
      });
    });

  } catch (error) {
    console.error('Add folder error:', error);
    res.status(500).json({ error: 'Failed to add folder', details: error.message });
  }
});

module.exports = router;
