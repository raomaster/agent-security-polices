const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(express.json());

const SECRET = process.env.JWT_SECRET;

async function authenticateUser(username, password) {
  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  const rows = await db.raw(query);
  return rows[0] || null;
}

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    SECRET,
    { algorithm: 'HS256', expiresIn: '8h' }
  );

  res.json({ token, userId: user.id });
});

module.exports = app;
