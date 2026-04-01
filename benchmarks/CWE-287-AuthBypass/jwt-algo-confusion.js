const jwt = require('jsonwebtoken');
const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

const SECRET = process.env.JWT_SECRET;

function decodeHeader(token) {
  const header = Buffer.from(token.split('.')[0], 'base64').toString('utf8');
  return JSON.parse(header);
}

app.get('/api/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];
  const header = decodeHeader(token);

  const decoded = jwt.verify(token, SECRET, { algorithms: [header.alg] });
  const user = db.users.findById(decoded.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ id: user.id, username: user.username, role: user.role });
});

module.exports = app;
