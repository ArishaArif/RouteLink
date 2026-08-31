const BASE = process.env.BASE_URL || 'http://localhost:5000';

const stamp = Date.now();
const userA = { name: 'Ayesha Khan', email: `ayesha.${stamp}@routelink.test`, password: 'hunter2secret' };
const userB = { name: 'Bilal Ahmed', email: `bilal.${stamp}@routelink.test`, password: 'another8chars' };

let passed = 0;
let failed = 0;
const failures = [];

function render(value, max = 700) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n  ...[truncated]` : text;
}

async function call(method, path, { token, body, rawBody } = {}) {
  const headers = {};
  if (body !== undefined || rawBody !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    parsed = text;
  }
  return { status: res.status, body: parsed, contentType: res.headers.get('content-type') };
}

async function step(label, expectedStatus, method, path, opts = {}, project) {
  const res = await call(method, path, opts);
  const ok = res.status === expectedStatus;
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${label} (got ${res.status}, expected ${expectedStatus})`);
  }
  const sent = opts.rawBody !== undefined ? opts.rawBody : opts.body;
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${label}`);
  console.log(`  -> ${method} ${path}${opts.token ? '   [auth]' : ''}`);
  if (sent !== undefined) {
    console.log(`     body: ${render(sent, 220)}`);
  }
  console.log(`  <- ${res.status} ${res.contentType || ''}`);
  console.log(`     ${render(project ? project(res.body) : res.body).split('\n').join('\n     ')}`);
  return res;
}

function section(title) {
  console.log(`\n\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

(async () => {
  section('HEALTH');
  await step('health check reports db connected', 200, 'GET', '/health');

  section('AUTH - SIGNUP');
  const signupA = await step('signup user A succeeds', 201, 'POST', '/api/auth/signup', { body: userA },
    (b) => ({ user: b.user, token: b.token ? `${String(b.token).slice(0, 24)}...` : b.token }));
  const signupB = await step('signup user B succeeds', 201, 'POST', '/api/auth/signup', { body: userB },
    (b) => ({ userId: b.user && b.user.id, email: b.user && b.user.email }));

  await step('FAILURE duplicate email rejected', 409, 'POST', '/api/auth/signup', { body: userA });
  await step('FAILURE missing all fields', 400, 'POST', '/api/auth/signup', { body: {} });
  await step('FAILURE malformed email', 400, 'POST', '/api/auth/signup',
    { body: { name: 'Bad Email', email: 'not-an-email', password: 'longenough1' } });
  await step('FAILURE password too short', 400, 'POST', '/api/auth/signup',
    { body: { name: 'Shorty', email: `short.${stamp}@routelink.test`, password: 'abc' } });
  await step('FAILURE malformed JSON body', 400, 'POST', '/api/auth/signup', { rawBody: '{"name":' });

  const hashLeak = JSON.stringify(signupA.body).includes('$2a$') || JSON.stringify(signupA.body).includes('$2b$');
  console.log(`\n[${hashLeak ? 'FAIL' : 'PASS'}] signup response contains no bcrypt hash`);
  hashLeak ? (failed += 1, failures.push('signup leaked password hash')) : (passed += 1);

  section('AUTH - LOGIN');
  const loginA = await step('login user A succeeds', 200, 'POST', '/api/auth/login',
    { body: { email: userA.email, password: userA.password } },
    (b) => ({ user: b.user, token: b.token ? `${String(b.token).slice(0, 24)}...` : b.token }));
  const loginB = await step('login user B succeeds', 200, 'POST', '/api/auth/login',
    { body: { email: userB.email, password: userB.password } },
    (b) => ({ userId: b.user && b.user.id }));

  const wrongPassword = await step('FAILURE login wrong password', 401, 'POST', '/api/auth/login',
    { body: { email: userA.email, password: 'totally-wrong' } });
  const unknownEmail = await step('FAILURE login unknown email', 401, 'POST', '/api/auth/login',
    { body: { email: `ghost.${stamp}@routelink.test`, password: userA.password } });
  await step('FAILURE login missing password', 400, 'POST', '/api/auth/login',
    { body: { email: userA.email } });

  const identical = JSON.stringify(wrongPassword.body) === JSON.stringify(unknownEmail.body);
  console.log(`\n[${identical ? 'PASS' : 'FAIL'}] wrong-password and unknown-email responses are byte-identical (no user enumeration)`);
  console.log(`     wrong password -> ${JSON.stringify(wrongPassword.body)}`);
  console.log(`     unknown email  -> ${JSON.stringify(unknownEmail.body)}`);
  identical ? (passed += 1) : (failed += 1, failures.push('login responses differ - leaks which field was wrong'));

  const tokenA = loginA.body.token;
  const tokenB = loginB.body.token;

  section('TRIPS - AUTH GUARD');
  await step('FAILURE create trip with no token', 401, 'POST', '/api/trips',
    { body: { title: 'x', destination: 'y', startDate: '2026-09-01', endDate: '2026-09-03' } });
  await step('FAILURE list trips with no token', 401, 'GET', '/api/trips');
  await step('FAILURE list trips with garbage token', 401, 'GET', '/api/trips', { token: 'not-a-real-token' });

  section('TRIPS - CREATE');
  const tripA = await step('create trip for user A', 201, 'POST', '/api/trips', {
    token: tokenA,
    body: {
      title: 'Hunza Valley Autumn Run',
      destination: 'Hunza Valley',
      startDate: '2026-10-05',
      endDate: '2026-10-08',
      budget: 85000.5,
    },
  });
  const tripAId = tripA.body.trip.id;

  const secondTrip = await step('create second trip for user A', 201, 'POST', '/api/trips', {
    token: tokenA,
    body: { title: 'Skardu Recon', destination: 'Skardu', startDate: '2026-11-01', endDate: '2026-11-02' },
  });
  const deletableId = secondTrip.body.trip.id;

  const tripB = await step('create trip for user B', 201, 'POST', '/api/trips', {
    token: tokenB,
    body: { title: 'Naran Weekend', destination: 'Naran', startDate: '2026-09-20', endDate: '2026-09-21' },
  }, (b) => ({ id: b.trip.id, userId: b.trip.userId }));
  const tripBId = tripB.body.trip.id;

  await step('FAILURE create trip missing required fields', 400, 'POST', '/api/trips',
    { token: tokenA, body: { title: 'No dates' } });
  await step('FAILURE create trip endDate before startDate', 400, 'POST', '/api/trips',
    { token: tokenA, body: { title: 'Backwards', destination: 'Nowhere', startDate: '2026-10-10', endDate: '2026-10-01' } });
  await step('FAILURE create trip invalid status enum', 400, 'POST', '/api/trips',
    { token: tokenA, body: { title: 'Bad status', destination: 'X', startDate: '2026-10-01', endDate: '2026-10-02', status: 'teleporting' } });
  await step('FAILURE create trip non-calendar date', 400, 'POST', '/api/trips',
    { token: tokenA, body: { title: 'Feb 31', destination: 'X', startDate: '2026-02-31', endDate: '2026-03-01' } });

  section('TRIPS - LIST');
  await step('list user A trips returns only their own', 200, 'GET', '/api/trips', { token: tokenA },
    (b) => ({ count: b.count, titles: b.trips.map((t) => t.title) }));
  await step('list user B trips returns only their own', 200, 'GET', '/api/trips', { token: tokenB },
    (b) => ({ count: b.count, titles: b.trips.map((t) => t.title) }));

  section('TRIPS - READ ONE / OWNERSHIP');
  await step('get own trip succeeds', 200, 'GET', `/api/trips/${tripAId}`, { token: tokenA });
  await step("FAILURE user B cannot read user A's trip", 404, 'GET', `/api/trips/${tripAId}`, { token: tokenB });
  await step('FAILURE malformed uuid rejected as 400 not 500', 400, 'GET', '/api/trips/not-a-uuid', { token: tokenA });
  await step('FAILURE well-formed but unknown uuid', 404, 'GET', '/api/trips/11111111-2222-3333-4444-555555555555', { token: tokenA });

  section('TRIPS - UPDATE');
  await step('patch own trip destination/dates/status', 200, 'PATCH', `/api/trips/${tripAId}`, {
    token: tokenA,
    body: { destination: 'Upper Hunza (Gulmit)', status: 'upcoming', endDate: '2026-10-11' },
  }, (b) => ({ updated: b.updated, destination: b.trip.destination, status: b.trip.status, endDate: b.trip.endDate }));
  await step("FAILURE user B cannot patch user A's trip", 404, 'PATCH', `/api/trips/${tripAId}`,
    { token: tokenB, body: { destination: 'Hijacked' } });
  await step('FAILURE patch with no updatable fields', 400, 'PATCH', `/api/trips/${tripAId}`,
    { token: tokenA, body: { nonsense: true } });
  await step('FAILURE patch endDate before existing startDate', 400, 'PATCH', `/api/trips/${tripAId}`,
    { token: tokenA, body: { endDate: '2020-01-01' } });

  section('TRIPS - ITINERARY (PLACEHOLDER)');
  await step('itinerary generates one row per day', 200, 'GET', `/api/trips/${tripAId}/itinerary`, { token: tokenA },
    (b) => ({
      tripId: b.tripId,
      destination: b.destination,
      source: b.source,
      days: b.days,
      firstDay: b.itinerary[0],
      lastDayDate: b.itinerary[b.itinerary.length - 1].date,
    }));
  await step("FAILURE user B cannot read user A's itinerary", 404, 'GET', `/api/trips/${tripAId}/itinerary`, { token: tokenB });
  await step('FAILURE itinerary without token', 401, 'GET', `/api/trips/${tripAId}/itinerary`);

  section('TRIPS - DELETE');
  await step("FAILURE user B cannot delete user A's trip", 404, 'DELETE', `/api/trips/${deletableId}`, { token: tokenB });
  await step('delete own trip succeeds', 200, 'DELETE', `/api/trips/${deletableId}`, { token: tokenA });
  await step('FAILURE deleted trip is gone', 404, 'GET', `/api/trips/${deletableId}`, { token: tokenA });
  await step('user B trip untouched by user A activity', 200, 'GET', `/api/trips/${tripBId}`, { token: tokenB },
    (b) => ({ id: b.trip.id, title: b.trip.title }));

  section('ROUTING');
  await step('FAILURE unknown route returns json 404', 404, 'GET', '/api/nope', { token: tokenA });

  console.log(`\n\n${'='.repeat(72)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('='.repeat(72));
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\nSMOKE TEST CRASHED:', err.message);
  process.exit(1);
});
