const express = require('express');
const app = express();

function requestLogger(req, res, next) {
    const start = Date.now();
    const method = req.method;
    const path = req.path;
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${method} ${path} from ${ip}`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${method} ${path} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
}

app.use(express.json());
app.use(requestLogger);

app.post('/login', (req, res) => {
    const { username } = req.body;
    const authenticated = authenticateUser(username, req.body.password);
    if (authenticated) {
        return res.json({ status: 'ok' });
    }
    res.status(401).json({ status: 'error' });
});

app.listen(3000);
