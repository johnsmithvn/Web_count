const express = require('express');

const router = express.Router();

// Get children folders for a specific parent path (for lazy loading)
router.get('/children/:encodedPath', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const parentPath = decodeURIComponent(req.params.encodedPath);
    
    db.all(`
      SELECT id, path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at,
             (SELECT COUNT(*) FROM folders f2 WHERE f2.parent_path = folders.path) as child_count
      FROM folders 
      WHERE parent_path = ?
      ORDER BY name
    `, [parentPath], (err, children) => {
      if (err) {
        console.error('Error fetching children:', err);
        return res.status(500).json({ error: 'Failed to fetch children' });
      }

      // Add hasChildren flag
      const childrenWithFlags = children.map(child => ({
        ...child,
        hasChildren: child.child_count > 0
      }));

      res.json({
        success: true,
        children: childrenWithFlags,
        parentPath
      });
    });
  } catch (error) {
    console.error('Children fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch children', details: error.message });
  }
});

// Advanced search endpoint
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const {
      query = '',
      mode = 'fuzzy', // exact, fuzzy, regex, word-based
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
      } else if (mode === 'word-based') {
        // Word-based search: tách query thành các words và match tất cả
        const words = query.trim().split(/\s+/).filter(word => word.length > 0);
        console.log('Word-based search - Query:', query, 'Words:', words);
        
        const wordConditions = [];
        
        words.forEach(word => {
          if (caseSensitive === 'true') {
            wordConditions.push('name LIKE ?');
          } else {
            wordConditions.push('LOWER(name) LIKE LOWER(?)');
          }
        });
        
        nameCondition = wordConditions.join(' AND ');
        
        // For path condition
        const pathWordConditions = [];
        words.forEach(word => {
          if (caseSensitive === 'true') {
            pathWordConditions.push('path LIKE ?');
          } else {
            pathWordConditions.push('LOWER(path) LIKE LOWER(?)');
          }
        });
        
        pathCondition = pathWordConditions.join(' AND ');
        console.log('Word-based conditions - Name:', nameCondition, 'Path:', pathCondition);
      }
      
      if (searchIn === 'name') {
        searchConditions.push(nameCondition);
        if (mode === 'word-based') {
          const words = query.trim().split(/\s+/).filter(word => word.length > 0);
          words.forEach(word => params.push(`%${word}%`));
        } else {
          params.push(mode === 'fuzzy' ? `%${query}%` : query);
        }
      } else if (searchIn === 'path') {
        searchConditions.push(pathCondition);
        if (mode === 'word-based') {
          const words = query.trim().split(/\s+/).filter(word => word.length > 0);
          words.forEach(word => params.push(`%${word}%`));
        } else {
          params.push(mode === 'fuzzy' ? `%${query}%` : query);
        }
      } else { // both
        searchConditions.push(`(${nameCondition} OR ${pathCondition})`);
        if (mode === 'word-based') {
          const words = query.trim().split(/\s+/).filter(word => word.length > 0);
          // Add parameters for name condition
          words.forEach(word => params.push(`%${word}%`));
          // Add parameters for path condition
          words.forEach(word => params.push(`%${word}%`));
        } else {
          params.push(mode === 'fuzzy' ? `%${query}%` : query);
          params.push(mode === 'fuzzy' ? `%${query}%` : query);
        }
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
        } else if (mode === 'word-based') {
          // Word-based search for files
          const words = query.trim().split(/\s+/).filter(word => word.length > 0);
          console.log('File search - Word-based search - Query:', query, 'Words:', words);
          
          const nameWordConditions = [];
          words.forEach(word => {
            if (caseSensitive === 'true') {
              nameWordConditions.push('f.name LIKE ?');
            } else {
              nameWordConditions.push('LOWER(f.name) LIKE LOWER(?)');
            }
          });
          nameCondition = nameWordConditions.join(' AND ');
          
          const pathWordConditions = [];
          words.forEach(word => {
            if (caseSensitive === 'true') {
              pathWordConditions.push('folders.path LIKE ?');
            } else {
              pathWordConditions.push('LOWER(folders.path) LIKE LOWER(?)');
            }
          });
          pathCondition = pathWordConditions.join(' AND ');
          
          console.log('File search - Word-based conditions - Name:', nameCondition, 'Path:', pathCondition);
        }
        
        if (searchIn === 'name') {
          fileConditions.push(nameCondition);
          if (mode === 'word-based') {
            const words = query.trim().split(/\s+/).filter(word => word.length > 0);
            words.forEach(word => fileParams.push(`%${word}%`));
          } else {
            fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
          }
        } else if (searchIn === 'path') {
          fileConditions.push(pathCondition);
          if (mode === 'word-based') {
            const words = query.trim().split(/\s+/).filter(word => word.length > 0);
            words.forEach(word => fileParams.push(`%${word}%`));
          } else {
            fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
          }
        } else { // both
          fileConditions.push(`(${nameCondition} OR ${pathCondition})`);
          if (mode === 'word-based') {
            const words = query.trim().split(/\s+/).filter(word => word.length > 0);
            // Add parameters for name condition
            words.forEach(word => fileParams.push(`%${word}%`));
            // Add parameters for path condition  
            words.forEach(word => fileParams.push(`%${word}%`));
          } else {
            fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
            fileParams.push(mode === 'fuzzy' ? `%${query}%` : query);
          }
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
