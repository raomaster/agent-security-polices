const express = require('express');
const { execFile } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

const ALLOWED_ENGINES = new Set(['pug', 'ejs', 'handlebars']);
const ALLOWED_TEMPLATES = new Set(['home.pug', 'about.pug', 'contact.ejs']);

app.post('/render', (req, res) => {
  const engine = req.body.engine;
  const template = req.body.template;

  if (!ALLOWED_ENGINES.has(engine)) {
    return res.status(400).json({ error: 'Engine not allowed' });
  }
  if (!ALLOWED_TEMPLATES.has(template)) {
    return res.status(400).json({ error: 'Template not allowed' });
  }

  const engineBin = path.join('node_modules', '.bin', engine);
  execFile(engineBin, ['--render', template], (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'Render failed' });
    }
    res.json({ output: stdout });
  });
});

app.listen(3000);
