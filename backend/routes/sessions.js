const express = require('express');
const db = require('../db');
const jwt = require('jsonwebtoken');

module.exports = function(io) {
  const router = express.Router();

  // Middleware to verify JWT
  function verifyToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token' });
    try {
      req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Get all active sessions for logged-in user
  router.get('/', verifyToken, async (req, res) => {
    const result = await db.query(
      'SELECT * FROM sessions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
      [req.user.userId, 'active']
    );
    res.json(result.rows);
  });

  // Extension reports a new session
  router.post('/report', verifyToken, async (req, res) => {
    const { domain, machine_id, machine_name } = req.body;
    try {
      const result = await db.query(
        `INSERT INTO sessions (user_id, domain, machine_id, machine_name, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (user_id, domain, machine_id)
         DO UPDATE SET status = 'active', updated_at = NOW()
         RETURNING *`,
        [req.user.userId, domain, machine_id, machine_name]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Remote logout - send command to extension on that machine
  router.post('/revoke/:sessionId', verifyToken, async (req, res) => {
    const { sessionId } = req.params;
    try {
      const session = await db.query(
        'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );
      if (session.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

      const s = session.rows[0];

      // Update DB
      await db.query('UPDATE sessions SET status = $1, updated_at = NOW() WHERE id = $2', ['revoked', sessionId]);

      // Send real-time command to the machine
      const connectedMachines = req.app.get('connectedMachines');
      const socketId = connectedMachines[s.machine_id];
      if (socketId) {
        io.to(socketId).emit('revoke_session', { domain: s.domain, sessionId });
      }

      res.json({ success: true, message: 'Logout command sent!' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Extension confirms logout done
  router.post('/confirm-revoke/:sessionId', verifyToken, async (req, res) => {
    await db.query('UPDATE sessions SET status = $1 WHERE id = $2', ['confirmed_revoked', req.params.sessionId]);
    res.json({ success: true });
  });

  return router;
};