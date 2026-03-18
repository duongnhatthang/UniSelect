// Load test script for UniSelect API endpoints using autocannon.
//
// Usage:
//   # Against local:  TARGET_URL=http://localhost:3000 npm run load-test
//   # Against prod:   TARGET_URL=https://your-app.vercel.app npm run load-test
//   # Custom params:  CONNECTIONS=100 DURATION=60 TARGET_URL=... npm run load-test
//
// Pass criteria: error rate <= 1% at 50 concurrent connections for 30 seconds.

import autocannon from 'autocannon';

const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:3000';
const DURATION = parseInt(process.env.DURATION ?? '30', 10);     // seconds
const CONNECTIONS = parseInt(process.env.CONNECTIONS ?? '50', 10); // concurrent

interface TestResult {
  title: string;
  errorRate: number;
  p99Latency: number;
  pass: boolean;
}

async function runTest(title: string, url: string): Promise<TestResult> {
  console.log(`\nRunning: ${title}`);
  console.log(`URL: ${url} | Connections: ${CONNECTIONS} | Duration: ${DURATION}s`);

  const result = await autocannon({
    url,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { 'Accept': 'application/json' },
  });

  const errorRate = result.non2xx / (result.requests.total || 1);
  const p99Latency = result.latency.p99;

  console.log(`  Requests/sec: ${result.requests.mean.toFixed(0)}`);
  console.log(`  Latency p99:  ${p99Latency}ms`);
  console.log(`  Errors (non-2xx): ${result.non2xx} (${(errorRate * 100).toFixed(2)}%)`);
  console.log(`  Status: ${errorRate > 0.01 ? 'FAIL (>1% errors)' : 'PASS'}`);

  return { title, errorRate, p99Latency, pass: errorRate <= 0.01 };
}

async function main(): Promise<void> {
  console.log('=== UniSelect Load Test ===');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Config: ${CONNECTIONS} connections, ${DURATION}s duration`);

  const results = await Promise.all([
    runTest(
      'GET /api/universities (list)',
      `${TARGET_URL}/api/universities`
    ),
    runTest(
      'GET /api/recommend (A00, score=24)',
      `${TARGET_URL}/api/recommend?tohop=A00&score=24`
    ),
  ]);

  console.log('\n=== Summary ===');
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${r.title} — error rate: ${(r.errorRate * 100).toFixed(2)}%, p99: ${r.p99Latency}ms`);
  }

  const allPass = results.every(r => r.pass);
  console.log(`\n${allPass ? 'ALL PASS' : 'SOME TESTS FAILED'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
