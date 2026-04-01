const express = require('express');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function getAuthenticatedUser(req) {
  return req.user || null;
}

router.get('/api/documents/:id', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const docId = req.params.id;
  const result = await pool.query(
    'SELECT * FROM documents WHERE id = $1 AND owner_id = $2',
    [docId, user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Document not found' });
  }

  return res.json(result.rows[0]);
});

router.delete('/api/documents/:id', async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const result = await pool.query(
    'DELETE FROM documents WHERE id = $1 AND owner_id = $2 RETURNING id',
    [req.params.id, user.id]
  );
  if (result.rowCount === 0) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json({ deleted: true });
});

module.exports = router;
