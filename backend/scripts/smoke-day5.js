require('dotenv').config();

const { getUserExcludeList, getUserDestinationState } = require('../services/getUserExcludeList');
const itinerarySource = require('../services/itinerarySource');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const stamp = Date.now();

const traveler = { name: 'Sana Iqbal', email: `d5.trav.${stamp}@routelink.test`, password: 'hunter2secret' };
const other = { name: 'Bilal Ahmed', email: `d5.other.${stamp}@routelink.test`, password: 'hunter2secret' };

let passed = 0;
let failed = 0;
const failures = [];

function render(value, max = 620) {
  if (value === undefined || value === null) {
    return String(value);
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n  ...[truncated]` : text;
}

function projectSafely(project, body) {
  if (!project) {
    return body;
  }
  try {
    return project(body);
  } catch (err) {
    return body;
  }
}

function section(title) {
  console.log(`\n\n${'='.repeat(74)}`);
  console.log(title);
  console.log('='.repeat(74));
}

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`\n[PASS] ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`\n[FAIL] ${label}`);
  }
  if (detail !== undefined) {
    console.log(`     ${render(detail).split('\n').join('\n     ')}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    parsed = text;
  }
  return { status: res.status, body: parsed };
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
  const credential = opts.token ? '   [auth]' : '   [no auth]';
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${label}`);
  console.log(`  -> ${method} ${path}${credential}`);
  if (opts.body !== undefined) {
    console.log(`     request  ${JSON.stringify(opts.body)}`);
  }
  console.log(`  <- ${res.status}`);
  console.log(`     ${render(projectSafely(project, res.body)).split('\n').join('\n     ')}`);
  return res;
}

(async () => {
  section('1. SETUP');
  const signup = await step('signup traveler', 201, 'POST', '/api/auth/signup', { body: traveler },
    (b) => ({ id: b.user.id, email: b.user.email }));
  const token = signup.body.token;
  const userId = signup.body.user.id;

  const otherSignup = await step('signup a second user for isolation checks', 201, 'POST', '/api/auth/signup',
    { body: other }, (b) => ({ id: b.user.id }));
  const otherToken = otherSignup.body.token;

  section('2. EMPTY STATE FOR A BRAND-NEW USER');
  const empty = await step('GET destination-state returns an empty list', 200, 'GET',
    '/api/users/me/destination-state', { token });
  check('empty state has count 0 and an empty excludeList',
    empty.body.count === 0 && Array.isArray(empty.body.excludeList) && empty.body.excludeList.length === 0,
    empty.body);

  const helperEmpty = await getUserExcludeList(userId);
  check('getUserExcludeList() returns [] for a new user',
    Array.isArray(helperEmpty) && helperEmpty.length === 0, helperEmpty);

  section('3. CREATE ENTRIES');
  await step('POST visited Hunza Valley creates a row', 201, 'POST', '/api/users/me/destination-state',
    { token, body: { destinationName: 'Hunza Valley', status: 'visited' } });

  await step('POST dismissed Fairy Meadows creates a second row', 201, 'POST', '/api/users/me/destination-state',
    { token, body: { destinationName: 'Fairy Meadows', status: 'dismissed' } });

  section('4. UPSERT — NO DUPLICATES, CASE-INSENSITIVE');
  const upsert = await step('POST the same place in different casing updates instead of duplicating', 200, 'POST',
    '/api/users/me/destination-state',
    { token, body: { destinationName: 'hunza valley', status: 'dismissed' } });
  check('upsert reports created: false', upsert.body.created === false, upsert.body);

  const afterUpsert = await step('GET shows 2 rows, not 3', 200, 'GET', '/api/users/me/destination-state',
    { token }, (b) => ({ count: b.count, excludeList: b.excludeList, destinationState: b.destinationState }));
  check('still exactly 2 rows after the duplicate write', afterUpsert.body.count === 2, afterUpsert.body.count);
  const hunza = afterUpsert.body.destinationState.find((row) => row.destinationName.toLowerCase() === 'hunza valley');
  check('the existing row flipped visited -> dismissed', hunza && hunza.status === 'dismissed', hunza);

  section('5. WHITESPACE NORMALIZATION');
  const messy = await step('POST a padded name stores it collapsed', 201, 'POST', '/api/users/me/destination-state',
    { token, body: { destinationName: '   Deosai    National  Park  ', status: 'visited' } });
  check('stored as "Deosai National Park"',
    messy.body.destinationState.destinationName === 'Deosai National Park',
    messy.body.destinationState.destinationName);

  section('6. EXCLUDE-LIST HELPER AFTER ENTRIES EXIST');
  const populated = await getUserExcludeList(userId);
  check('getUserExcludeList() returns all 3 names, visited + dismissed combined',
    populated.length === 3
      && populated.includes('Fairy Meadows')
      && populated.includes('Deosai National Park')
      && populated.some((name) => name.toLowerCase() === 'hunza valley'),
    populated);

  const split = await getUserDestinationState(userId);
  check('getUserDestinationState() also exposes the visited/dismissed split',
    split.visited.length === 1 && split.dismissed.length === 2 && split.all.length === 3,
    { visited: split.visited, dismissed: split.dismissed });

  section('7. VALIDATION');
  const badCases = [
    ['FAILURE missing destinationName', { status: 'visited' }],
    ['FAILURE empty destinationName', { destinationName: '   ', status: 'visited' }],
    ['FAILURE missing status', { destinationName: 'Skardu' }],
    ['FAILURE unknown status value', { destinationName: 'Skardu', status: 'wishlisted' }],
    ['FAILURE snake_case / unknown field', { destination_name: 'Skardu', status: 'visited' }],
    ['FAILURE extra field alongside valid ones', { destinationName: 'Skardu', status: 'visited', notes: 'nope' }],
  ];
  for (const [label, body] of badCases) {
    await step(label, 400, 'POST', '/api/users/me/destination-state', { token, body },
      (b) => b.details || b.error);
  }

  section('8. AUTH AND PER-USER ISOLATION');
  await step('FAILURE no token on GET', 401, 'GET', '/api/users/me/destination-state', {});
  await step('FAILURE no token on POST', 401, 'POST', '/api/users/me/destination-state',
    { body: { destinationName: 'Skardu', status: 'visited' } });

  const isolated = await step('a different user sees none of the first user rows', 200, 'GET',
    '/api/users/me/destination-state', { token: otherToken }, (b) => ({ count: b.count, excludeList: b.excludeList }));
  check('second user count is 0', isolated.body.count === 0, isolated.body.count);

  section('9. EXCLUDE LIST REACHES THE RECOMMENDER');
  const direct = await itinerarySource.fetchItinerary(
    { destination: 'Hunza Valley' },
    ['2026-10-05'],
    { exclude: populated },
  );
  const returnedNames = direct.recommendations.map((entry) => entry.name);
  check('fetchItinerary() echoes the exclude list it was given',
    JSON.stringify(direct.excludeApplied) === JSON.stringify(populated), direct.excludeApplied);
  check('no excluded destination appears in the returned pool',
    !returnedNames.some((name) => populated.some((skip) => skip.toLowerCase() === name.toLowerCase())),
    returnedNames);
  check('pool is still 6-8 ranked options after filtering',
    direct.recommendations.length >= 6 && direct.recommendations.length <= 8,
    direct.recommendations.length);

  section('10. END-TO-END THROUGH THE ITINERARY ENDPOINT');
  const trip = await step('create a trip', 201, 'POST', '/api/trips', {
    token,
    body: {
      title: 'Day 5 exclude-list check',
      destination: 'Hunza Valley',
      startDate: '2026-10-05',
      endDate: '2026-10-08',
    },
  }, (b) => ({ id: b.trip.id, destination: b.trip.destination }));

  const itinerary = await step('GET the itinerary', 200, 'GET', `/api/trips/${trip.body.trip.id}/itinerary`,
    { token }, (b) => ({
      source: b.source,
      excludeApplied: b.excludeApplied,
      recommendationPool: Array.isArray(b.recommendationPool)
        ? b.recommendationPool.map((entry) => entry.name)
        : b.recommendationPool,
      marketplaceOnRestDay: (b.itinerary || [])
        .filter((day) => day.needsMarketplaceData)
        .map((day) => ({
          dayNumber: day.dayNumber,
          slotType: day.slotType,
          heatTier: day.heatTier,
          guides: day.marketplace ? day.marketplace.guides.length : null,
          fallbackMessage: day.fallbackMessage,
        })),
    }));

  if (itinerary.body.source === 'ml-preview') {
    check('response carries excludeApplied with all 3 names',
      Array.isArray(itinerary.body.excludeApplied) && itinerary.body.excludeApplied.length === 3,
      itinerary.body.excludeApplied);
    check('recommendationPool excludes every seen destination',
      !itinerary.body.recommendationPool.some((entry) => populated
        .some((skip) => skip.toLowerCase() === entry.name.toLowerCase())),
      itinerary.body.recommendationPool.map((entry) => entry.name));
  } else {
    console.log(`\n[SKIP] end-to-end exclude assertions — server has ITINERARY_ML_MOCK off `
      + `(source was "${itinerary.body.source}"). Section 9 proved the wiring in-process. `
      + `Start the server with ITINERARY_ML_MOCK=true to assert it over HTTP.`);
  }

  console.log(`\n\n${'='.repeat(74)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('='.repeat(74));
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\nSMOKE TEST CRASHED:', err);
  process.exit(1);
});
