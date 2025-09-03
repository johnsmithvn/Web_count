const express = require('express');

const router = express.Router();

// Advanced search endpoint
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const {
      query = '',
      mode = 'fuzzy', // exact, fuzzy, regex
      caseSensitive = 'false',
      searchType = 'both', // folders, files, both
      searchIn = 'both', // name, path, both
      extension = '',
      sizeMin = '',
      sizeMax = '',
      dateFrom = '',
      dateTo = '',
      page = 1,
      limit = 100
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let results = { folders: [], files: [], totalFolders: 0, totalFiles: 0 };

    // Build search conditions
    const searchConditions = [];
    const params = [];

    if (query) {
      let nameCondition = '';
      let pathCondition = '';
      
      if (mode === 'exact') {
        if (caseSensitive === 'true') {
          nameCondition = 'name = ?';
          pathCondition = 'path = ?';
        } else {
          nameCondition = 'LOWER(name) = LOWER(?)';
          pathCondition = 'LOWER(path) = LOWER(?)';
        }
      } else if (mode === 'fuzzy') {
        if (caseSensitive === 'true') {
          nameCondition = 'name LIKE ?';
          pathCondition = 'path LIKE ?';
        } else {
          nameCondition = 'LOWER(name) LIKE LOWER(?)';
          pathCondition = 'LOWER(path) LIKE LOWER(?)';
        }
      }
      
      if (searchIn === 'name') {
        searchConditions.push(nameCondition);
        params.push(mode === 'fuzzy' ? `%${query}%` : query);
      } else if (searchIn === 'path') {
        searchConditions.push(pathCondition);
        params.push(mode === 'fuzzy' ? `%${query}%` : query);
      } else { // both
        searchConditions.push(`(${nameCondition} OR ${pathCondition})`);
        params.push(mode === 'fuzzy' ? `%${query}%` : query);
        params.push(mode === 'fuzzy' ? `%${query}%` : query);
      }
      
      // Note: SQLite doesn't support REGEXP by default, so we'll treat it as fuzzy
    }

    // Date range filter
    if (dateFrom) {
      searchConditions.push('modified_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      searchConditions.push('modified_at <= ?');
      params.push(dateTo);
    }

    const whereClause = searchConditions.length > 0 ? 
      `WHERE ${searchConditions.join(' AND ')}` : '';

    // Search folders
    if (searchType === 'folders' || searchType === 'both') {
      const folderQuery = `
        SELECT id, path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at
        FROM folders 
        ${whereClause}
        ORDER BY path
        LIMIT ? OFFSET ?
      `;
      
      const countQuery = `
        SELECT COUNT(*) as count FROM folders ${whereClause}
      `;

      db.all(folderQuery, [...params, limitNum, offset], (err, folders) => {
        if (err) {
          console.warn('Folder search error:', err.message);
          results.folders = [];
        } else {
          results.folders = folders || [];
        }

        db.get(countQuery, params, (err, count) => {
          if (err) {
            console.warn('Folder count error:', err.message);
            results.totalFolders = 0;
          } else {
            results.totalFolders = count.count || 0;
          }

          // Search files if needed
          if (searchType === 'files' || searchType === 'both') {
            searchFiles();
          } else {
            sendResults();
          }
        });
      });
    } else if (searchType === 'files') {
      searchFiles();
    } else {
      sendResults();
    }

    function searchFiles() {
      const fileConditions = [];
      const fileParams = [];

      // Build file-specific search conditions
      if (query) {
        let nameCondition = '';
        let pathCondition = '';
        
        if (mode === 'exact') {
          if (caseSensitive === 'true') {
            nameCondition = 'f.name = ?';
            pathCondition = 'folders.path = ?';
          } else {
            nameCondition = 'LOWER(f.name) = LOWER(?)';
            pathCondition = 'LOWER(folders.path) = LOWER(?)';
          }
        } else if (mode === 'fuzzy') {
          if (caseSensitive === 'true') {
            nameCondition = 'f.name LIKE ?';
            pathCondition = 'folders.path LIKE ?';
          } else {
            nameCondition = 'LOWER(f.name) LIKE LOWER(?)';
            pathCondition = 'LOWER(folders.path) LIKE LOWER(?)';
          }
        }
        
        if (searchIn === 'name') {
          fileConditions.push(nameCondition);
          fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
        } else if (searchIn === 'path') {
          fileConditions.push(pathCondition);
          fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
        } else { // both
          fileConditions.push(`(${nameCondition} OR ${pathCondition})`);
          fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
          fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
        }
      }

      // Date range filter
      if (dateFrom) {
        fileConditions.push('f.modified_at >= ?');
        fileParams.push(dateFrom);
      }
      if (dateTo) {
        fileConditions.push('f.modified_at <= ?');
        fileParams.push(dateTo);
      }

      // Extension filter
      if (extension) {
        fileConditions.push('f.extension = ?');
        fileParams.push(extension);
      }

      // Size range filter
      if (sizeMin) {
        fileConditions.push('f.size >= ?');
        fileParams.push(parseInt(sizeMin));
      }
      if (sizeMax) {
        fileConditions.push('f.size <= ?');
        fileParams.push(parseInt(sizeMax));
      }

      const fileWhereClause = fileConditions.length > 0 ? 
        `WHERE ${fileConditions.join(' AND ')}` : '';

      const fileQuery = `
        SELECT f.id, f.name, f.extension, f.size, f.created_at, f.modified_at, f.accessed_at, f.scanned_at,
               folders.path as folder_path
        FROM files f
        LEFT JOIN folders ON f.folder_id = folders.id
        ${fileWhereClause}
        ORDER BY folders.path, f.name
        LIMIT ? OFFSET ?
      `;
      
      const fileCountQuery = `
        SELECT COUNT(*) as count 
        FROM files f
        LEFT JOIN folders ON f.folder_id = folders.id
        ${fileWhereClause}
      `;

      db.all(fileQuery, [...fileParams, limitNum, offset], (err, files) => {
        if (err) {
          console.warn('File search error:', err.message);
          results.files = [];
        } else {
          results.files = files || [];
        }

        db.get(fileCountQuery, fileParams, (err, count) => {
          if (err) {
            console.warn('File count error:', err.message);
            results.totalFiles = 0;
          } else {
            results.totalFiles = count.count || 0;
          }

          sendResults();
        });
      });
    }

    function sendResults() {
      // Add pagination info
      results.pagination = {
        page: parseInt(page),
        limit: limitNum,
        totalPages: Math.ceil((results.totalFolders + results.totalFiles) / limitNum)
      };

      res.json(results);
    }

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Simple search endpoint (for backward compatibility)
router.get('/fts', (req, res) => {
  // For now, redirect to regular search since FTS5 may not be available
  req.query.mode = 'fuzzy';
  return router.handle(req, res);
});

// Get all file extensions
router.get('/extensions', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    db.all(`
      SELECT extension, COUNT(*) as count 
      FROM files 
      WHERE extension IS NOT NULL AND extension != ''
      GROUP BY extension 
      ORDER BY count DESC, extension
    `, (err, extensions) => {
      if (err) {
        console.error('Extensions error:', err);
        res.status(500).json({ error: 'Could not get extensions' });
      } else {
        res.json(extensions || []);
      }
    });
  } catch (error) {
    console.error('Extensions error:', error);
    res.status(500).json({ error: 'Could not get extensions' });
  }
});

module.exports = router;
