const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(express.json());

const SECRET = process.env.JWT_SECRET;
const MAX_PASSWORD_BYTES = 72;

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await db.users.findByUsername(username);
  const storedHash = user ? user.password : 'x'.repeat(60);

  const inputBuf = Buffer.alloc(MAX_PASSWORD_BYTES);
  const storedBuf = Buffer.alloc(MAX_PASSWORD_BYTES);
  inputBuf.write(password.slice(0, MAX_PASSWORD_BYTES));
  storedBuf.write(storedHash.slice(0, MAX_PASSWORD_BYTES));

  const match = crypto.timingSafeEqual(inputBuf, storedBuf);
  if (!user || !match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    SECRET,
    { algorithm: 'HS256', expiresIn: '8h' }
  );
  res.json({ token, expiresIn: 28800 });
});

module.exports = app;
