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
  ancestorLevels = '0',
    ancestorMode = 'from-root', // 'from-root' | 'from-match'
      page = 1,
      limit = 100
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let results = { folders: [], files: [], totalFolders: 0, totalFiles: 0 };

    // Helper: check if a folder NAME matches query according to mode/case rules
    const doesNameMatch = (nameVal) => {
      if (!query) return false;
      const cs = caseSensitive === 'true';
      const name = String(nameVal || '');
      const q = String(query);
      if (mode === 'exact') {
        return cs ? name === q : name.toLowerCase() === q.toLowerCase();
      }
      if (mode === 'word-based') {
        const words = q.trim().split(/\s+/).filter(Boolean);
        const hay = cs ? name : name.toLowerCase();
        return words.every(w => (cs ? w : w.toLowerCase()) && hay.includes(cs ? w : w.toLowerCase()));
      }
      // regex is treated as fuzzy elsewhere; keep same here
      // fuzzy (default)
      const hay = cs ? name : name.toLowerCase();
      const needle = cs ? q : q.toLowerCase();
      return hay.includes(needle);
    };

    // Build search conditions
    const searchConditions = [];
    const params = [];

    if (query) {
      let nameCondition = '';
      let pathCondition = '';
      let nameParams = [];
      let pathParams = [];

      const words = mode === 'word-based'
        ? query.trim().split(/\s+/).filter(w => w.length > 0)
        : [];

      if (mode === 'exact') {
        if (caseSensitive === 'true') {
          nameCondition = 'name = ?';
          pathCondition = 'path = ?';
        } else {
          nameCondition = 'LOWER(name) = LOWER(?)';
          pathCondition = 'LOWER(path) = LOWER(?)';
        }
        const v = (val) => val;
        nameParams = [v(query)];
        pathParams = [v(query)];
      } else if (mode === 'fuzzy') {
        if (caseSensitive === 'true') {
          nameCondition = 'name LIKE ?';
          pathCondition = 'path LIKE ?';
        } else {
          nameCondition = 'LOWER(name) LIKE LOWER(?)';
          pathCondition = 'LOWER(path) LIKE LOWER(?)';
        }
        const like = (val) => `%${val}%`;
        nameParams = [like(query)];
        pathParams = [like(query)];
      } else if (mode === 'word-based') {
        // Word-based search: tách query thành các words và match tất cả
        console.log('Word-based search - Query:', query, 'Words:', words);

        const toCond = (col) => words.map(() => (caseSensitive === 'true' ? `${col} LIKE ?` : `LOWER(${col}) LIKE LOWER(?)`)).join(' AND ');
        nameCondition = words.length ? toCond('name') : '';
        pathCondition = words.length ? toCond('path') : '';
        nameParams = words.map(w => `%${w}%`);
        pathParams = words.map(w => `%${w}%`);
        console.log('Word-based conditions - Name:', nameCondition, 'Path:', pathCondition);
      }

      // Attach conditions according to searchIn
      if (searchIn === 'name') {
        if (nameCondition) {
          searchConditions.push(`(${nameCondition})`);
          params.push(...nameParams);
        }
      } else if (searchIn === 'path') {
        if (pathCondition) {
          searchConditions.push(`(${pathCondition})`);
          params.push(...pathParams);
        }
      } else { // both
        const hasName = !!nameCondition;
        const hasPath = !!pathCondition;
        if (hasName && hasPath) {
          searchConditions.push(`((${nameCondition}) OR (${pathCondition}))`);
          params.push(...nameParams, ...pathParams);
        } else if (hasName) {
          searchConditions.push(`(${nameCondition})`);
          params.push(...nameParams);
        } else if (hasPath) {
          searchConditions.push(`(${pathCondition})`);
          params.push(...pathParams);
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

    // Helper: when ancestorLevels>0 and query targets folders, fetch ancestors via recursive CTE
  const includeAncestors = !!query && Number.parseInt(ancestorLevels) > 0 && (searchType === 'folders' || searchType === 'both');

    // Search folders
    if (searchType === 'folders' || searchType === 'both') {
      const baseFolderQuery = `
        SELECT id, path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at
        FROM folders 
        ${whereClause}
      `;

      const folderQuery = `
        ${baseFolderQuery}
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
          return afterFolder();
        }

        const pageMatches = folders || [];
        const n = includeAncestors ? Math.max(0, Math.min(20, parseInt(ancestorLevels))) : 0;

        // Option 2 semantics: count from ROOT. When n>0, include the full ancestor chain
        // from the root down to each match so the tree can render a connected path.
  if (includeAncestors && pageMatches.length > 0 && n > 0) {
          const needed = new Set();
          const expandSet = new Set();
          const anchorSet = new Set();
          const branchChildSet = new Set();
          const highlightSet = new Set();

          pageMatches.forEach(m => {
            if (!m?.path) return;
            if (doesNameMatch(m.name)) {
              highlightSet.add(m.path);
            }
            // Build chain from match up to root
            const chain = [];
            let cur = m.path;
            let safety = 0;
            while (cur && safety < 300) {
              chain.push(cur);
              const idx = cur.lastIndexOf('\\');
              if (idx <= 2) break;
              cur = cur.substring(0, idx);
              safety++;
            }
            const chainFromRoot = chain.reverse();

            // Collect all nodes needed for tree rendering and auto-expand
            chainFromRoot.forEach(p => {
              needed.add(p);
              expandSet.add(p);
            });

            // Determine anchor index based on mode
            let anchorIndex;
            if (ancestorMode === 'from-match') {
              // Include last N parents above the match
              // chainFromRoot: [root ... parent, match]
              // N=1 -> anchor at parent; N=0 -> anchor at match
              const lastIdx = chainFromRoot.length - 1;
              anchorIndex = Math.max(0, lastIdx - n);
            } else {
              // from-root (default) — count from top
              anchorIndex = Math.min(n, Math.max(0, chainFromRoot.length - 1));
            }
            const anchor = chainFromRoot[anchorIndex] || chainFromRoot[chainFromRoot.length - 1];
            if (anchor) anchorSet.add(anchor);
            const branchIndex = Math.min(anchorIndex + 1, chainFromRoot.length - 1);
            const branchChild = chainFromRoot[branchIndex];
            if (branchChild) branchChildSet.add(branchChild);
          });

          const placeholders = Array.from(needed).map(() => '?').join(',');
          const selectAnc = `
            SELECT id, path, name, parent_path, level, created_at, modified_at, accessed_at, scanned_at
            FROM folders
            WHERE path IN (${placeholders})
          `;

          db.all(selectAnc, Array.from(needed), (err2, rows) => {
            results.folders = err2 ? pageMatches : (rows || []).sort((a, b) => a.path.localeCompare(b.path));

            // Provide helpers as arrays
            results.expandPaths = Array.from(expandSet);
            results.anchorPaths = Array.from(anchorSet);
            results.showAllFromPaths = Array.from(branchChildSet);
            results.highlightPaths = Array.from(highlightSet);

            // Backward-compatible single values (first items if present)
            if (results.anchorPaths.length > 0) results.anchorPath = results.anchorPaths[0];
            if (results.showAllFromPaths.length > 0) results.showAllFromPath = results.showAllFromPaths[0];
            if (results.highlightPaths.length > 0) results.highlightPath = results.highlightPaths[0];

            afterFolder();
          });
        } else {
          results.folders = pageMatches;
          // Highlight only those whose NAME matched (avoid path-only highlight)
          if (pageMatches.length > 0) {
            const hp = pageMatches.filter(m => doesNameMatch(m.name)).map(m => m.path);
            results.highlightPaths = hp;
            if (hp.length > 0) results.highlightPath = hp[0];
          }
          afterFolder();
        }

        function afterFolder() {
          db.get(countQuery, params, (err3, count) => {
            results.totalFolders = err3 ? 0 : (count?.count || 0);
            if (searchType === 'files' || searchType === 'both') {
              searchFiles();
            } else {
              sendResults();
            }
          });
        }
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
        let nameParams = [];
        let pathParams = [];

        const words = mode === 'word-based'
          ? query.trim().split(/\s+/).filter(w => w.length > 0)
          : [];

        if (mode === 'exact') {
          if (caseSensitive === 'true') {
            nameCondition = 'f.name = ?';
            pathCondition = 'folders.path = ?';
          } else {
            nameCondition = 'LOWER(f.name) = LOWER(?)';
            pathCondition = 'LOWER(folders.path) = LOWER(?)';
          }
          nameParams = [query];
          pathParams = [query];
        } else if (mode === 'fuzzy') {
          if (caseSensitive === 'true') {
            nameCondition = 'f.name LIKE ?';
            pathCondition = 'folders.path LIKE ?';
          } else {
            nameCondition = 'LOWER(f.name) LIKE LOWER(?)';
            pathCondition = 'LOWER(folders.path) LIKE LOWER(?)';
          }
          nameParams = [`%${query}%`];
          pathParams = [`%${query}%`];
        } else if (mode === 'word-based') {
          // Word-based search for files
          console.log('File search - Word-based search - Query:', query, 'Words:', words);

          const toCond = (col) => words.map(() => (caseSensitive === 'true' ? `${col} LIKE ?` : `LOWER(${col}) LIKE LOWER(?)`)).join(' AND ');
          nameCondition = words.length ? toCond('f.name') : '';
          pathCondition = words.length ? toCond('folders.path') : '';
          nameParams = words.map(w => `%${w}%`);
          pathParams = words.map(w => `%${w}%`);

          console.log('File search - Word-based conditions - Name:', nameCondition, 'Path:', pathCondition);
        }

        if (searchIn === 'name') {
          if (nameCondition) {
            fileConditions.push(`(${nameCondition})`);
            fileParams.push(...nameParams);
          }
        } else if (searchIn === 'path') {
          if (pathCondition) {
            fileConditions.push(`(${pathCondition})`);
            fileParams.push(...pathParams);
          }
        } else { // both
          const hasName = !!nameCondition;
          const hasPath = !!pathCondition;
          if (hasName && hasPath) {
            fileConditions.push(`((${nameCondition}) OR (${pathCondition}))`);
            fileParams.push(...nameParams, ...pathParams);
          } else if (hasName) {
            fileConditions.push(`(${nameCondition})`);
            fileParams.push(...nameParams);
          } else if (hasPath) {
            fileConditions.push(`(${pathCondition})`);
            fileParams.push(...pathParams);
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
