const jwt = require('jsonwebtoken');
const store = require('../services/store');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_travelbee_jwt_secret_key_2026';

// 1. IP Firewall Middleware
function checkIpFirewall(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  if (store.blockedIps.has(ip)) {
    store.addSecurityLog({
      type: 'FIREWALL_BLOCKED_REQUEST',
      severity: 'CRITICAL',
      message: `Blocked request from blacklisted IP: ${ip}`,
      ip: ip,
      details: { path: req.originalUrl, method: req.method }
    });
    return res.status(403).json({ error: 'Access denied: IP address blacklisted due to suspicious activity.' });
  }
  next();
}

// 2. Recursive NoSQL Sanitizer
function sanitizeObject(obj) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        // Log the sanitization event
        const sanitizedKey = key.replace(/[\$.]/g, '');
        obj[sanitizedKey] = obj[key];
        delete obj[key];
        sanitizeObject(obj[sanitizedKey]);
      } else {
        sanitizeObject(obj[key]);
      }
    }
  }
}

function sanitizeNoSql(req, res, next) {
  const originalBody = JSON.stringify(req.body);
  const originalQuery = JSON.stringify(req.query);

  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);

  // If payload changed, log injection attempt
  if (JSON.stringify(req.body) !== originalBody || JSON.stringify(req.query) !== originalQuery) {
    const ip = req.ip || req.connection.remoteAddress;
    store.addSecurityLog({
      type: 'NOSQL_INJECTION_ATTEMPT',
      severity: 'HIGH',
      message: `NoSQL Injection attempt detected and sanitized from IP ${ip}`,
      ip: ip,
      details: {
        originalQuery: req.query,
        originalBody: req.body,
        path: req.originalUrl
      }
    });
  }
  next();
}

// 3. JWT Authenticator
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      const ip = req.ip || req.connection.remoteAddress;
      store.addSecurityLog({
        type: 'INVALID_TOKEN_PRESENTED',
        severity: 'WARNING',
        message: `Failed JWT validation from IP ${ip}`,
        ip: ip,
        details: { error: err.message }
      });
      return res.status(403).json({ error: 'Session expired or invalid token.' });
    }
    
    // Check if account is locked
    if (store.lockedAccounts.has(user.email)) {
      return res.status(403).json({ error: 'Your account has been temporarily locked.' });
    }

    req.user = user;
    next();
  });
}

// 4. Role Based Access Control (RBAC) Guard
function authorizeRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      const ip = req.ip || req.connection.remoteAddress;
      store.addSecurityLog({
        type: 'PRIVILEGE_ESCALATION_ATTEMPT',
        severity: 'HIGH',
        message: `User ${req.user.email} (Role: ${req.user.role}) attempted unauthorized access to ${req.originalUrl}`,
        ip: ip,
        details: { user: req.user.email, attemptedRole: req.user.role, requiredRoles: allowedRoles }
      });
      return res.status(403).json({ error: 'Access forbidden: Insufficient permissions.' });
    }
    next();
  };
}

module.exports = {
  checkIpFirewall,
  sanitizeNoSql,
  authenticateToken,
  authorizeRoles
};
