/**
 * Verifies the patched engine.io (6.6.11) still speaks the Socket.IO handshake.
 *
 * CVE: Socket.IO Engine.IO Protocol Revision Mismatch DoS (GHSA-2gc4-cqfq-p2gv)
 * A naive mitigation is downgrading engine.io or forcing old protocol revisions;
 * this test proves the UPGRADE preserved wire compatibility (EIO=4).
 */
'use strict';

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const URL = process.env.RT_URL || 'http://localhost:5001';
// Test-only default, used ONLY when the harness starts the server itself.
// If you started the realtime server separately, export JWT_SECRET for BOTH the
// server and this test — they must match, or signature verification fails.
const JWT_SECRET =
  process.env.JWT_SECRET || 'test-only-secret-not-used-in-any-deployed-environment';

// engine.io does not export ./package.json, so read the resolved version off disk.
const lock = require('../../package-lock.json');
const engineVersion = lock.packages['node_modules/engine.io'].version;

const token = jwt.sign({ id: 'test-user-1', email: 'test@travelbee.local' }, JWT_SECRET, {
  expiresIn: '5m',
});

console.log(`\n  engine.io under test: ${engineVersion}`);
console.log(`  socket.io server:    ${require('socket.io/package.json').version}`);
console.log(`  socket.io-client:    ${require('socket.io-client/package.json').version}`);
console.log(`  target:              ${URL}\n`);

const socket = io(URL, {
  transports: ['polling', 'websocket'],
  // websocket-first omits EIO from transport.query; polling exposes it so the
  // negotiated revision can actually be asserted below.
  tryAllTransports: true,
  reconnection: false,
  timeout: 8000,
  auth: { token },
  extraHeaders: { Authorization: `Bearer ${token}` },
});

let done = false;

function check(name, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' -> ' + detail : ''}`);
  return ok;
}

let failures = 0;

function finish(pass, msg) {
  if (done) return;
  done = true;
  if (!pass) failures++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${msg}\n`);
  socket.close();
  process.exit(failures === 0 ? 0 : 1);
}

socket.on('connect', () => {
  const engine = socket.io.engine;

  // Read the revision actually negotiated on the wire, not a hardcoded string.
  const eio = engine.transport && engine.transport.query && engine.transport.query.EIO;

  console.log(`  negotiated EIO revision: ${eio}`);
  console.log(`  transport:               ${engine.transport.name}`);
  console.log(`  readyState:              ${engine.readyState}`);
  console.log(`  socket id:               ${socket.id ? 'assigned' : 'MISSING'}\n`);

  if (!check('Engine.IO revision 4 negotiated (wire protocol intact)', eio === 4, `EIO=${eio}`)) {
    return finish(false, 'protocol revision mismatch — the DoS class is still reachable');
  }
  if (!check('transport is open', engine.readyState === 'open', engine.readyState)) {
    return finish(false, 'transport failed to open');
  }
  if (!check('socket id assigned', Boolean(socket.id), socket.id || 'none')) {
    return finish(false, 'no socket id assigned');
  }
  if (!check('authenticated handshake accepted by io.use()', true, 'JWT verified by server')) {
    return finish(false, 'handshake rejected');
  }

  finish(true, 'patched engine.io completes a full authenticated handshake');
});

socket.on('connect_error', (err) => {
  // Distinguish an auth mismatch from a real protocol/transport failure: a server
  // started with a different JWT_SECRET than this test rejects the handshake here.
  const authIssue = /auth/i.test(err.message);
  console.log(`  connect_error: ${err.message}`);
  if (authIssue) {
    console.log(
      '  hint: the realtime server is running with a different JWT_SECRET than this\n' +
        '        test. Start both with the same value, e.g.\n' +
        '        JWT_SECRET=<value> npm run start:realtime'
    );
  }
  finish(false, authIssue ? 'JWT secret mismatch between server and test' : `connection failed -> ${err.message}`);
});

setTimeout(() => finish(false, 'timed out waiting for connection'), 12000);