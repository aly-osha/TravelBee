const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const store = require('./services/store');
const { checkIpFirewall, sanitizeNoSql } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Helmet Secure HTTP Headers (XSS, CSP protection)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://*.tile.openstreetmap.org"]
    }
  }
}));

// 2. CORS setup
app.use(cors({
  origin: '*', // Allow all for demo purposes, restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Parser Limits (Prevent Denial of Service)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. IP Firewall check & NoSQL injection sanitizer (runs globally)
app.use(checkIpFirewall);
app.use(sanitizeNoSql);

// 5. Mount subservice routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/places', require('./routes/places'));
app.use('/api/users', require('./routes/users'));
app.use('/api/security', require('./routes/security'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/health', require('./routes/health'));

// 6. Security-aware Image Upload Endpoint (Attack 4 Countermeasure)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB Upload Limit
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { originalname, mimetype, buffer } = req.file;
  
  // A. MIME validation against signature
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedMimeTypes.includes(mimetype)) {
    store.addSecurityLog({
      type: 'FILE_SCAN_FAILURE',
      severity: 'WARNING',
      message: `Blocked file upload: Invalid MIME type signature "${mimetype}" for file "${originalname}"`,
      ip: ip,
      details: { originalname, mimetype }
    });
    return res.status(400).json({ error: 'File upload rejected: Only JPEG, PNG, and GIF images are allowed.' });
  }

  // B. Polyglot / WebShell Content Scan
  // Read the binary buffer as a string to scan for malicious code
  const fileContent = buffer.toString('utf-8');
  const maliciousSignatures = [
    '<?php', 'eval(', 'system(', 'shell_exec(', 'exec(', 'passthru(',
    '<script>', 'javascript:', 'onload=', 'onerror='
  ];

  const foundSignature = maliciousSignatures.find(sig => fileContent.includes(sig));

  if (foundSignature) {
    store.addSecurityLog({
      type: 'FILE_SCAN_FAILURE',
      severity: 'CRITICAL',
      message: `Malicious polyglot file upload blocked! Embedded signature "${foundSignature}" found in "${originalname}"`,
      ip: ip,
      details: { originalname, mimetype, detectedSignature: foundSignature }
    });
    return res.status(400).json({ error: 'Malicious upload blocked: Image scanner flagged the file as dangerous.' });
  }

  // C. Approved: Mock URL generation
  const fileId = `img-${Date.now()}`;
  store.addSecurityLog({
    type: 'FILE_SCAN_SUCCESS',
    severity: 'INFO',
    message: `File uploaded and scanned successfully: ${originalname}`,
    ip: ip,
    details: { originalname, mimetype, size: buffer.length }
  });

  res.json({
    url: `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800`, // mock successful upload url
    message: 'File scanned and uploaded successfully.'
  });
});

// Default error handler middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    const ip = req.ip || req.connection.remoteAddress;
    store.addSecurityLog({
      type: 'FILE_SCAN_FAILURE',
      severity: 'WARNING',
      message: `Blocked file upload: File size exceeds 5MB limit`,
      ip: ip,
      details: { error: err.message }
    });
    return res.status(400).json({ error: 'File upload rejected: Maximum size limit is 5MB.' });
  }
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`🐝 Travel Bee API Server running on port ${PORT}`);
});
