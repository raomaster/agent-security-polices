const express = require('express');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

app.post('/render', (req, res) => {
  const template = req.body.template;
  const engine = req.body.engine || 'pug';
  const cmd = `node_modules/.bin/${engine} --render "${template}"`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr });
    }
    res.json({ output: stdout });
  });
});

app.post('/compile', (req, res) => {
  const template = req.body.template;
  const outFile = req.body.output || 'out.html';
  exec(`pug -o /tmp/rendered "${template}" > /tmp/${outFile}`, (error, stdout) => {
    res.json({ status: 'compiled', output: stdout });
  });
});

app.listen(3000);
