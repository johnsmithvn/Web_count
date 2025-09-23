const express = require('express');
const bcrypt = require('bcryptjs');

const router = express.Router();

const ensureAdminAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access admin resources'
    });
  }

  if (req.user.is_admin !== 1) {
    return res.status(403).json({
      error: 'Admin privileges required',
      message: 'You need admin permissions to perform this action'
    });
  }

  next();
};

const runAsync = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });

const getAsync = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });

router.use(ensureAdminAccess);

// Get aggregated statistics for all users
router.get('/users', (req, res) => {
  const db = req.app.locals.db;

  const query = `
    SELECT 
      u.id,
      u.username,
      u.email,
      u.is_admin AS isAdmin,
      u.created_at AS createdAt,
      u.updated_at AS updatedAt,
      u.last_login AS lastLogin,
      COALESCE(scan_stats.scan_count, 0) AS scanCount,
      COALESCE(folder_stats.folder_count, 0) AS folderCount,
      COALESCE(file_stats.file_count, 0) AS fileCount,
      COALESCE(folder_stats.folder_count, 0) + COALESCE(file_stats.file_count, 0) AS dataCount
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS scan_count
      FROM scans
      GROUP BY user_id
    ) AS scan_stats ON scan_stats.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS folder_count
      FROM folders
      GROUP BY user_id
    ) AS folder_stats ON folder_stats.user_id = u.id
    LEFT JOIN (
      SELECT flds.user_id, COUNT(fls.id) AS file_count
      FROM files fls
      INNER JOIN folders flds ON flds.id = fls.folder_id
      GROUP BY flds.user_id
    ) AS file_stats ON file_stats.user_id = u.id
    ORDER BY u.created_at ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch users for admin panel:', err);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const users = rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      isAdmin: row.isAdmin === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastLogin: row.lastLogin,
      scanCount: row.scanCount,
      folderCount: row.folderCount,
      fileCount: row.fileCount,
      dataCount: row.dataCount
    }));

    res.json({ success: true, users });
  });
});

// Update user password (admin reset)
router.put('/users/:id/password', async (req, res) => {
  const db = req.app.locals.db;
  const userId = parseInt(req.params.id, 10);
  const { newPassword } = req.body;

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      error: 'Invalid password',
      message: 'New password must be at least 6 characters long'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId],
      function(err) {
        if (err) {
          console.error('Failed to update user password:', err);
          return res.status(500).json({ error: 'Failed to update password' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: 'Password updated successfully' });
      }
    );
  } catch (error) {
    console.error('Password hashing failed:', error);
    res.status(500).json({ error: 'Failed to process password' });
  }
});

// Delete a user and all of their related data
router.delete('/users/:id', async (req, res) => {
  const db = req.app.locals.db;
  const userId = parseInt(req.params.id, 10);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (userId === req.user.id) {
    return res.status(400).json({
      error: 'Cannot delete active account',
      message: 'You cannot delete the account currently logged in'
    });
  }

  let transactionStarted = false;

  try {
    const existingUser = await getAsync(db, 'SELECT id FROM users WHERE id = ?', [userId]);

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await runAsync(db, 'BEGIN TRANSACTION');
    transactionStarted = true;

    await runAsync(
      db,
      'DELETE FROM files WHERE folder_id IN (SELECT id FROM folders WHERE user_id = ?)',
      [userId]
    );

    await runAsync(db, 'DELETE FROM folders WHERE user_id = ?', [userId]);
    await runAsync(db, 'DELETE FROM scans WHERE user_id = ?', [userId]);
    await runAsync(db, 'DELETE FROM users WHERE id = ?', [userId]);
    await runAsync(db, 'COMMIT');

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user and related data:', error);

    if (transactionStarted) {
      try {
        await runAsync(db, 'ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError);
      }
    }

    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;

