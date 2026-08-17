const express = require('express');
const router = express.Router();
const store = require('../services/store');
const { authenticateToken, authorizeRoles } = require('../middleware/security');

// Authenticate all requests first
router.use(authenticateToken);

// 1. Moderator/Super Admin Route: View pending places awaiting approval
router.get('/pending-places', authorizeRoles(['Moderator', 'Super Admin']), (req, res) => {
  const pending = store.places.filter(p => !p.approved);
  res.json(pending);
});

// 2. Moderator/Super Admin Route: Approve a submitted place
router.post('/approve-place/:id', authorizeRoles(['Moderator', 'Super Admin']), (req, res) => {
  const place = store.places.find(p => p.id === req.params.id);
  if (!place) return res.status(404).json({ error: 'Place not found.' });

  place.approved = true;

  const ip = req.ip || req.connection.remoteAddress;
  store.addSecurityLog({
    type: 'PLACE_APPROVED',
    severity: 'INFO',
    message: `Moderator ${req.user.email} approved place: ${place.name}`,
    ip: ip,
    details: { placeId: place.id, approvedBy: req.user.email }
  });

  res.json({ message: `Successfully approved place: ${place.name}`, place });
});

// 3. Super Admin Route: Get list of all registered users
router.get('/users', authorizeRoles(['Super Admin']), (req, res) => {
  // Strip passwords for safety
  const safeUsers = store.users.map(u => {
    const { password, ...safe } = u;
    return safe;
  });
  res.json(safeUsers);
});

// 4. Super Admin Route: Create a new privileged user (e.g. Moderator/Security Analyst)
router.post('/users', authorizeRoles(['Super Admin']), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  const allowedPrivilegedRoles = ['Moderator', 'Security Analyst', 'Super Admin'];
  if (!allowedPrivilegedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selection.' });
  }

  const existingUser = store.findUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email address already in use.' });
  }

  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = store.addUser({
    name,
    email,
    password: hashedPassword,
    role,
    interests: [],
    location: null,
    optInLocation: false
  });

  const ip = req.ip || req.connection.remoteAddress;
  store.addSecurityLog({
    type: 'USER_CREATED_BY_ADMIN',
    severity: 'HIGH',
    message: `Super Admin ${req.user.email} created new privileged account: ${email} (${role})`,
    ip: ip,
    details: { creator: req.user.email, email, role }
  });

  const { password: _, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

module.exports = router;
