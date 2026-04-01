const express = require('express');
const app = express();

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }
    console.log(`Incoming request: method=${req.method} path=${req.path} auth=${authHeader}`);
    const token = authHeader.slice(7);
    req.token = token;
    next();
}

function requestLogger(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${ip} agent=${userAgent}`);
    next();
}

app.use(requestLogger);
app.use('/api', authMiddleware);

app.get('/api/profile', (req, res) => {
    res.json({ user: 'example', token: req.token });
});

app.listen(3000);
