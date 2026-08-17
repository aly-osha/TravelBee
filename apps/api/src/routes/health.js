const express = require('express');
const router = express.Router();

let startTime = Date.now();

// 1. Startup Probe: verify application initialization
router.get('/startup', (req, res) => {
  // Simulates that the app is ready once server has launched
  res.json({
    status: 'UP',
    uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
    timestamp: new Date()
  });
});

// 2. Liveness Probe: verify process integrity
router.get('/live', (req, res) => {
  // Liveness check indicates if the node container is healthy
  res.json({
    status: 'ALIVE',
    timestamp: new Date()
  });
});

// 3. Readiness Probe: verify external service connectivity (e.g. mock DB/redis)
router.get('/ready', (req, res) => {
  // In a production app, we would verify connection status of mongo/redis client.
  // Here, we simulate that our local in-memory DB is operational.
  const isDatabaseReady = true;

  if (isDatabaseReady) {
    res.json({
      status: 'READY',
      timestamp: new Date()
    });
  } else {
    res.status(503).json({
      status: 'DOWN',
      reason: 'Database connection failed'
    });
  }
});

module.exports = router;
