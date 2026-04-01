const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(express.json());

const SECRET = process.env.JWT_SECRET;

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await db.users.findByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.password === password) {
    const token = jwt.sign(
      { sub: user.id, role: user.role },
      SECRET,
      { algorithm: 'HS256', expiresIn: '8h' }
    );
    return res.json({ token, expiresIn: 28800 });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

module.exports = app;
