const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const SESSION_STORE = new Map();

app.post('/sessions', (req, res) => {
  const sessionId = crypto.randomUUID();
  SESSION_STORE.set(sessionId, { userId: req.body.userId, created: Date.now() });
  res.json({ sessionId });
});

app.post('/api-keys', (req, res) => {
  const apiKey = crypto.randomBytes(32).toString('hex');
  res.json({ apiKey });
});

app.post('/reset-codes', (req, res) => {
  const code = crypto.randomInt(100000, 999999).toString();
  res.json({ code });
});

app.get('/sessions/:id', (req, res) => {
  const session = SESSION_STORE.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

app.listen(3000);
