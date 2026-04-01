const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const ASSETS_DIR = path.resolve(__dirname, 'assets');

function isSafePath(requestedPath) {
  const resolved = path.resolve(ASSETS_DIR, requestedPath);
  return resolved.startsWith(ASSETS_DIR + path.sep) || resolved === ASSETS_DIR;
}

router.get('/download', (req, res) => {
  const filename = req.query.file;
  if (!filename) {
    return res.status(400).json({ error: 'Missing file parameter' });
  }

  if (!isSafePath(filename)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const safePath = path.resolve(ASSETS_DIR, filename);
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.sendFile(safePath);
});

router.get('/preview/:category', (req, res) => {
  const { category } = req.params;
  const name = req.query.name;
  if (!name) {
    return res.status(400).json({ error: 'Missing name parameter' });
  }

  const relative = path.join(category, name);
  if (!isSafePath(relative)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const safePath = path.resolve(ASSETS_DIR, relative);
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.sendFile(safePath);
});

module.exports = router;
