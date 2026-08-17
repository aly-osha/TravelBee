const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('../services/store');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_travelbee_jwt_secret_key_2026';

// Dedicated login rate limiter: 5 attempts per 1 minute
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again after 60 seconds.' },
  handler: (req, res, next, options) => {
    const ip = req.ip || req.connection.remoteAddress;
    store.addSecurityLog({
      type: 'BRUTE_FORCE_ATTEMPT',
      severity: 'HIGH',
      message: `Login rate limit exceeded by IP: ${ip}`,
      ip: ip,
      details: { email: req.body.email, path: req.originalUrl }
    });
    res.status(options.statusCode).send(options.message);
  }
});

// Authentication Routes
router.post('/register', async (req, res) => {
  const { name, email, password, interests, lat, lng } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  // Prevent admin registrations from public form
  const existingUser = store.findUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email address already in use.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = store.addUser({
      name,
      email,
      password: hashedPassword,
      role: 'Traveler', // Default public signup role
      interests: Array.isArray(interests) ? interests : [],
      location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      optInLocation: true
    });

    store.addSecurityLog({
      type: 'USER_REGISTERED',
      severity: 'INFO',
      message: `New traveler account registered: ${email}`,
      ip: ip,
      details: { email }
    });

    // Create Token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        interests: newUser.interests
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed due to server error.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = store.findUserByEmail(email);

  // Check Account Lockout
  if (store.lockedAccounts.has(email)) {
    const lockout = store.loginAttempts[email];
    if (lockout && lockout.lockUntil > Date.now()) {
      return res.status(403).json({ error: `Account locked due to brute force protection. Try again later.` });
    } else {
      store.lockedAccounts.delete(email);
      delete store.loginAttempts[email];
    }
  }

  if (!user) {
    // Audit log failed login
    store.addSecurityLog({
      type: 'AUTHENTICATION_FAILED',
      severity: 'WARNING',
      message: `Failed login attempt for non-existent user: ${email}`,
      ip: ip,
      details: { email }
    });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    // Record login failure for lockouts
    if (!store.loginAttempts[email]) {
      store.loginAttempts[email] = { count: 0, lockUntil: null };
    }
    store.loginAttempts[email].count += 1;

    if (store.loginAttempts[email].count >= 5) {
      store.lockedAccounts.add(email);
      store.loginAttempts[email].lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins

      store.addSecurityLog({
        type: 'ACCOUNT_LOCKOUT',
        severity: 'HIGH',
        message: `Account temporarily locked due to 5 consecutive login failures: ${email}`,
        ip: ip,
        details: { email }
      });
      return res.status(403).json({ error: 'Account locked due to brute-force protection. Locked for 15 minutes.' });
    }

    store.addSecurityLog({
      type: 'AUTHENTICATION_FAILED',
      severity: 'WARNING',
      message: `Failed login attempt for user: ${email} (Count: ${store.loginAttempts[email].count})`,
      ip: ip,
      details: { email }
    });

    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Clear failed login attempts on success
  delete store.loginAttempts[email];
  store.lockedAccounts.delete(email);

  // Issue short-lived Token (1 hour)
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  store.addSecurityLog({
    type: 'AUTHENTICATION_SUCCESS',
    severity: 'INFO',
    message: `User ${email} (${user.role}) logged in successfully.`,
    ip: ip,
    details: { email, role: user.role }
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      interests: user.interests,
      location: user.location,
      optInLocation: user.optInLocation
    }
  });
});

module.exports = router;
