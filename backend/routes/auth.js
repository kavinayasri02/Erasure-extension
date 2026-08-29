const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Simple login with email (no password for MVP)
router.post('/login', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // Find or create user
    let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (result.rows.length === 0) {
      const insert = await db.query(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
        [email, name || email.split('@')[0]]
      );
      user = insert.rows[0];
    } else {
      user = result.rows[0];
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;