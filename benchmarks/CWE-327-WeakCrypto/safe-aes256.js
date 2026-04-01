const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

app.post('/encrypt', (req, res) => {
  const plaintext = req.body.data;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  res.json({
    iv: iv.toString('base64'),
    encrypted,
    tag,
  });
});

app.post('/decrypt', (req, res) => {
  const { iv, encrypted, tag } = req.body;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    KEY,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  res.json({ decrypted });
});

app.listen(3000);
