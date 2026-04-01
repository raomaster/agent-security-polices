const express = require('express');
const redis = require('redis');

const app = express();
app.use(express.json({ limit: '64kb' }));

const client = redis.createClient({ url: process.env.REDIS_URL });

function validateSession(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  if (typeof obj.id !== 'string' || obj.id.length > 128) return false;
  if (typeof obj.userId !== 'number') return false;
  if (!['user', 'admin', 'moderator'].includes(obj.role)) return false;
  return true;
}

app.post('/api/session/restore', async (req, res) => {
  const { sessionData } = req.body;
  if (typeof sessionData !== 'string') {
    return res.status(400).json({ error: 'sessionData must be a string' });
  }

  let session;
  try {
    session = JSON.parse(sessionData);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (!validateSession(session)) {
    return res.status(400).json({ error: 'Invalid session schema' });
  }

  await client.set(`session:${session.id}`, JSON.stringify(session), { EX: 3600 });
  res.json({ restored: true, sessionId: session.id });
});

module.exports = app;
