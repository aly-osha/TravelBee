/**
 * Verification: confirms the patched qs (6.16.0) blocks both 2026 advisories
 * on the exact code path Travel Bee uses: express.urlencoded({ extended: true }).
 *
 *   CVE-2026-82562  arrayLimit bypass via bracket-key comma parsing (GHSA-x5fp-wj9c-mxmx)
 *   CVE-2026-82417  DoS via Attacker Controlled isBuffer        (GHSA-4mjr-xmp4-gh2g)
 *
 * NOTE ON TEST DESIGN: an earlier draft asserted qs rejects a 100k-element bracket
 * payload under {comma:true, arrayLimit:20}. It does not. That config omits
 * throwOnLimitExceeded, in which qs has always truncated only flat values —
 * behaviour verified identical in 6.15.3 and 6.16.0. Express and body-parser never
 * set that flag, so the assertion tested a config no code path in this app reaches.
 * The checks below match the configuration the app actually runs.
 */
'use strict';

const express = require('express');
const qs = require('qs');

let pass = 0;
let fail = 0;

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ' -> ' + detail : ''}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`);
  }
}

console.log(`\nqs version under test: ${require('qs/package.json').version}`);
console.log(`node: ${process.version}\n`);

console.log('--- Advisory 1: arrayLimit bypass via bracket-key comma parsing ---');
{
  // The advisory's documented PoC requires BOTH comma:true AND throwOnLimitExceeded.
  let threw = false;
  try {
    qs.parse('a[]=1,2,3,4', { comma: true, arrayLimit: 3, throwOnLimitExceeded: true });
  } catch (e) { threw = e instanceof RangeError; }
  check(
    'bracket form rejected when throwOnLimitExceeded is set',
    threw,
    threw ? 'threw RangeError' : 'accepted'
  );

  // Reachability: body-parser owns the options, so confirm it never enables the
  // two flags the advisory requires, and that nesting stays bounded.
  const bodyParserSrc = require('fs').readFileSync(
    require.resolve('body-parser/lib/types/urlencoded.js'), 'utf8'
  );
  check('body-parser never sets comma:true (advisory trigger absent)', !/comma\s*:/.test(bodyParserSrc));
  check('body-parser sets strictDepth so nesting is bounded', /strictDepth:\s*true/.test(bodyParserSrc));
  check(
    'body-parser derives arrayLimit from parameterCount',
    /arrayLimit = Math\.max\(100, paramCount\)/.test(bodyParserSrc)
  );
}

console.log('\n--- Advisory 2: DoS via Attacker Controlled isBuffer ---');
{
  // Pure parse -> stringify round trip, no JSON.parse. Threw a TypeError on 6.15.3.
  const qs2 = require('qs');
  let threwTypeError = false;
  let detail = '';
  try {
    const parsed = qs2.parse('x%5Bconstructor%5D%5BisBuffer%5D=y', { plainObjects: true });
    detail = JSON.stringify(parsed).slice(0, 60);
    qs2.stringify(parsed);
  } catch (e) {
    threwTypeError = e instanceof TypeError;
    detail = e.constructor.name + ': ' + e.message.slice(0, 70);
  }
  check(
    'parse(plainObjects) -> stringify does not throw TypeError',
    !threwTypeError,
    threwTypeError ? detail : 'completed safely'
  );
}

console.log('\n--- Live Express surface: express.urlencoded({ extended: true }) ---');
{
  const app = express();
  // This mirrors apps/api/src/server.js line 33 exactly.
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.post('/echo', (req, res) => res.json({ ok: true, body: req.body }));

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const results = [];

    async function post(body, contentType) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/echo`, {
          method: 'POST',
          headers: { 'Content-Type': contentType || 'application/x-www-form-urlencoded' },
          body: body,
        });
        return { status: r.status, ok: r.ok };
      } catch (e) {
        return { status: 0, error: e.message };
      }
    }

    results.push(await post('name=travelbee&role=user'));
    results.push(await post('{"name":"travelbee"}', 'application/json'));

    check(
      'normal urlencoded form still parses correctly',
      results[0].status === 200,
      `HTTP ${results[0].status}`
    );
    check('normal JSON body still parses', results[1].status === 200, `HTTP ${results[1].status}`);

    // Nesting bomb: bounded by strictDepth, must not kill the process.
    results.push(await post('a' + '[b]'.repeat(500) + '=1'));
    check(
      'deep-nesting bomb rejected, process survives',
      results[2].status >= 400,
      `HTTP ${results[2].status}`
    );

    // Travel Bee's 2mb limit is the real outer bound on this DoS class.
    const huge = 'a[]=' + '1,'.repeat(2_500_000) + '1';
    const hugeStatus = (await post(huge)).status;
    check(
      `oversized ${(huge.length / 1048576).toFixed(1)}MB payload blocked by body limit`,
      hugeStatus === 413,
      `HTTP ${hugeStatus}`
    );

    server.close(() => {
      console.log(`\n${'='.repeat(52)}`);
      console.log(`  RESULT: ${pass} passed, ${fail} failed`);
      console.log(`${'='.repeat(52)}\n`);
      process.exit(fail === 0 ? 0 : 1);
    });
  });
}
