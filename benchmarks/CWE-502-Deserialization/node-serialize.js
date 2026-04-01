const express = require('express');
const serialize = require('node-serialize');
const redis = require('redis');

const app = express();
app.use(express.json());

const client = redis.createClient({ url: process.env.REDIS_URL });

app.post('/api/session/restore', async (req, res) => {
  const { sessionData } = req.body;
  if (!sessionData) {
    return res.status(400).json({ error: 'sessionData is required' });
  }

  const session = serialize.unserialize(sessionData);
  await client.set(`session:${session.id}`, JSON.stringify(session), { EX: 3600 });
  res.json({ restored: true, sessionId: session.id });
});

app.get('/api/session/:id', async (req, res) => {
  const raw = await client.get(`session:${req.params.id}`);
  if (!raw) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(JSON.parse(raw));
});

app.delete('/api/session/:id', async (req, res) => {
  await client.del(`session:${req.params.id}`);
  res.json({ deleted: true });
});

module.exports = app;
