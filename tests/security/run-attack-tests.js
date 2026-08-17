const { spawn } = require('child_process');
const path = require('path');

const API_URL = 'http://localhost:5000';
let apiProcess = null;

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startApiServer() {
  console.log('🚀 Starting API Backend Server for Security Tests...');
  const serverPath = path.join(__dirname, '../../apps/api/src/server.js');
  
  apiProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: '5000', NODE_ENV: 'test' }
  });

  apiProcess.stdout.on('data', (data) => {
    // console.log(`[API STDOUT]: ${data}`);
  });

  apiProcess.stderr.on('data', (data) => {
    console.error(`[API STDERR]: ${data}`);
  });

  // Give it 3 seconds to spin up
  await sleep(3000);
}

function stopApiServer() {
  if (apiProcess) {
    console.log('🛑 Shutting down test API Backend Server...');
    apiProcess.kill();
  }
}

// Global test results collector
const results = [];

function assertTest(name, passed) {
  results.push({ name, passed });
  console.log(`${passed ? '🟢 PASS' : '❌ FAIL'} - ${name}`);
}

async function runTests() {
  try {
    // -------------------------------------------------------------
    // Test 1: NoSQL Injection Sanitization
    // -------------------------------------------------------------
    console.log('\n🔍 Running Test 1: NoSQL Injection Bypass Prevention...');
    const nosqlRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: { "$ne": "admin@travelbee.com" }, 
        password: "wrong-password" 
      })
    });
    // Expected response should be 401 Unauthorized or 400 Bad Request, NOT a bypass
    assertTest('NoSQL Injection Sanitization (Returns 401/400)', nosqlRes.status === 401 || nosqlRes.status === 400);

    // -------------------------------------------------------------
    // Get Traveler Token for authorized tests
    // -------------------------------------------------------------
    let travelerToken = '';
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@travelbee.com', password: 'password123' })
    });
    if (loginRes.ok) {
      const data = await loginRes.json();
      travelerToken = data.token;
    } else {
      throw new Error('Failed to log in traveler to retrieve JWT.');
    }

    // -------------------------------------------------------------
    // Test 2: Insecure Direct Object Reference (IDOR) Protection
    // -------------------------------------------------------------
    console.log('\n🔍 Running Test 2: IDOR Guard Verification...');
    const idorRes = await fetch(`${API_URL}/api/users/idor-test/messages?senderId=user-traveler-2&receiverId=user-traveler-3`, {
      headers: { 'Authorization': `Bearer ${travelerToken}` }
    });
    // Expected response: 403 Forbidden because traveler rahul is querying maria and john's conversation
    assertTest('IDOR Message Access Prevention (Returns 403)', idorRes.status === 403);

    // -------------------------------------------------------------
    // Test 3: Privilege Escalation Prevention
    // -------------------------------------------------------------
    console.log('\n🔍 Running Test 3: Privilege Escalation Guard Verification...');
    const privRes = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${travelerToken}` }
    });
    // Expected response: 403 Forbidden because Traveler role cannot fetch all admin users
    assertTest('Privilege Escalation Blocked (Returns 403)', privRes.status === 403);

    // -------------------------------------------------------------
    // Test 4: Malicious Multipart Polyglot Upload Filter
    // -------------------------------------------------------------
    console.log('\n🔍 Running Test 4: Image Malware Polyglot Scanning...');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    
    // Obfuscate PHP signature dynamically to prevent Windows Defender quarantine
    const phpSig = '<?' + 'php ' + 'system' + '($_GET["cmd"]); ' + '?>';
    
    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="exploit.png"\r\n` +
      `Content-Type: image/png\r\n\r\n` +
      `PNG89a... ${phpSig}\r\n` +
      `--${boundary}--\r\n`;

    const uploadRes = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });
    // Expected response: 400 Bad Request since the file includes a PHP execution block signature
    assertTest('Polyglot Script Scan Quarantine (Returns 400)', uploadRes.status === 400);

    // -------------------------------------------------------------
    // Test 5: Brute Force Authentication Rate Limiting
    // -------------------------------------------------------------
    console.log('\n🔍 Running Test 5: Brute Force API Rate Limiter Verification...');
    let rateLimited = false;
    // Dispatch 8 login requests rapidly. The rate limit is 5 requests per minute.
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rahul@travelbee.com', password: `invalid-pass-${i}` })
      });
      if (res.status === 429 || res.status === 403) {
        rateLimited = true;
        break;
      }
      await sleep(50); // slight sleep
    }
    assertTest('Brute Force Limiter (Returns 429 or 403 Lockout)', rateLimited);

  } catch (err) {
    console.error('❌ Error during security test run:', err.message);
  }
}

async function main() {
  await startApiServer();
  await runTests();
  stopApiServer();

  console.log('\n=========================================');
  console.log('📜 Security Penetration Test Summary');
  console.log('=========================================');
  const allPassed = results.every(r => r.passed);
  results.forEach(r => {
    console.log(`${r.passed ? '🟢 PASSED' : '❌ FAILED'} - ${r.name}`);
  });

  if (allPassed) {
    console.log('\n🛡️ Success: All security tests passed. Countermeasures verified.');
    process.exit(0);
  } else {
    console.error('\n⚠️ Failure: One or more security vulnerabilities were not stopped.');
    process.exit(1);
  }
}

main();
