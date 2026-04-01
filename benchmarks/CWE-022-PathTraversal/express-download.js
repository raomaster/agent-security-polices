const express = require('express');
const path = require('path');

const router = express.Router();
const ASSETS_DIR = path.join(__dirname, 'assets');

router.get('/download', (req, res) => {
  const filename = req.query.file;
  if (!filename) {
    return res.status(400).json({ error: 'Missing file parameter' });
  }
  const filePath = path.join(ASSETS_DIR, filename);
  res.sendFile(filePath);
});

router.get('/preview/:category', (req, res) => {
  const { category } = req.params;
  const name = req.query.name;
  if (!name) {
    return res.status(400).json({ error: 'Missing name parameter' });
  }
  const filePath = path.join(ASSETS_DIR, category, name);
  res.sendFile(filePath);
});

router.get('/export', (req, res) => {
  const report = req.query.report || 'summary';
  const month = req.query.month || 'current';
  const target = path.join(ASSETS_DIR, 'reports', month, `${report}.csv`);
  res.sendFile(target);
});

module.exports = router;
