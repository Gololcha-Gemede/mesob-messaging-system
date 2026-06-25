const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const sseService = require('../services/sseService');
const { getEnv } = require('../config/env');

router.get('/events', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, getEnv('JWT_SECRET'), (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }

    const origin = req.headers.origin || '';
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.id })}\n\n`);

    sseService.addClient(user.id, res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });
});

module.exports = router;
