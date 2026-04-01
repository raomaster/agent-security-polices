const express = require('express');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

router.put('/api/users/:id', requireAuth, async (req, res) => {
  const userId = req.params.id;

  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updates = req.body;
  await pool.query(
    'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4',
    [updates.name, updates.email, updates.role, userId]
  );

  const result = await pool.query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [userId]
  );
  return res.json(result.rows[0]);
});

module.exports = router;
