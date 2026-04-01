const express = require('express');

const app = express();
app.use(express.json());

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateApiKey() {
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += Math.floor(Math.random() * 16).toString(16);
  }
  return key;
}

app.post('/sessions', (req, res) => {
  const sessionId = generateUUID();
  res.json({ sessionId });
});

app.post('/api-keys', (req, res) => {
  const apiKey = generateApiKey();
  res.json({ apiKey });
});

app.listen(3000);
