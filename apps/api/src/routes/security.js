const express = require('express');
const router = express.Router();
const store = require('../services/store');
const { authenticateToken, authorizeRoles } = require('../middleware/security');

// Guard all endpoints under /api/security to Security Analysts and Super Admins
router.use(authenticateToken);
router.use(authorizeRoles(['Security Analyst', 'Super Admin']));

// 1. Get security logs
router.get('/logs', (req, res) => {
  res.json(store.securityLogs);
});

// 2. Get security metrics
router.get('/metrics', (req, res) => {
  const logs = store.securityLogs;

  const failedLogins = logs.filter(l => l.type === 'AUTHENTICATION_FAILED').length;
  const blockedAccounts = store.lockedAccounts.size;
  const suspiciousRequests = logs.filter(l => 
    l.type === 'NOSQL_INJECTION_ATTEMPT' || 
    l.type === 'IDOR_ATTEMPT' || 
    l.type === 'PRIVILEGE_ESCALATION_ATTEMPT'
  ).length;
  const apiRateLimitEvents = logs.filter(l => 
    l.type === 'RATE_LIMIT_EXCEEDED' || 
    l.type === 'BRUTE_FORCE_ATTEMPT'
  ).length;
  const fileScanFailures = logs.filter(l => l.type === 'FILE_SCAN_FAILURE').length;
  
  res.json({
    failedLogins,
    blockedAccounts,
    suspiciousRequests,
    apiRateLimitEvents,
    fileScanFailures,
    blockedIps: store.blockedIps.size
  });
});

// 3. Block or unblock an IP manually
router.post('/block-ip', (req, res) => {
  const { ip, block } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP address is required.' });

  const analyst = req.user.email;
  const systemIp = req.ip || req.connection.remoteAddress;

  if (block) {
    store.blockedIps.add(ip);
    store.addSecurityLog({
      type: 'IP_BLOCKED_BY_ANALYST',
      severity: 'HIGH',
      message: `IP ${ip} blacklisted manually by analyst ${analyst}`,
      ip: systemIp,
      details: { blockedIp: ip, analyst }
    });
    res.json({ message: `Successfully blacklisted IP: ${ip}` });
  } else {
    store.blockedIps.delete(ip);
    store.addSecurityLog({
      type: 'IP_UNBLOCKED_BY_ANALYST',
      severity: 'INFO',
      message: `IP ${ip} whitelisted manually by analyst ${analyst}`,
      ip: systemIp,
      details: { unblockedIp: ip, analyst }
    });
    res.json({ message: `Successfully whitelisted IP: ${ip}` });
  }
});

// 4. Reset Simulator state (utility to reset logs for testing)
router.post('/reset', (req, res) => {
  store.securityLogs.length = 0;
  store.blockedIps.clear();
  store.lockedAccounts.clear();
  Object.keys(store.loginAttempts).forEach(k => delete store.loginAttempts[k]);
  
  // Re-add default startup success log
  store.addSecurityLog({
    type: 'AUTHENTICATION_SUCCESS',
    severity: 'INFO',
    message: `User ${req.user.email} reset the Security Simulator state.`,
    ip: req.ip || req.connection.remoteAddress,
    details: { email: req.user.email }
  });

  res.json({ message: 'Security simulator metrics and logs have been reset successfully.' });
});

module.exports = router;
