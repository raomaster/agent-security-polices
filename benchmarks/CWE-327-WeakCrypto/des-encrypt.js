const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const LEGACY_KEY = Buffer.from(process.env.LEGACY_KEY || 'mysecret', 'utf8');

app.post('/encrypt', (req, res) => {
  const plaintext = req.body.data;
  const cipher = crypto.createCipheriv('des-cbc', LEGACY_KEY.slice(0, 8), Buffer.alloc(8));
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  res.json({ encrypted });
});

app.post('/decrypt', (req, res) => {
  const ciphertext = req.body.data;
  const decipher = crypto.createDecipheriv('des-cbc', LEGACY_KEY.slice(0, 8), Buffer.alloc(8));
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  res.json({ decrypted });
});

app.listen(3000);
