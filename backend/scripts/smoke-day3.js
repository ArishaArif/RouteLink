require('dotenv').config();
const { User } = require('../models');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const INGEST_KEY = process.env.HAZARD_INGEST_KEY;
const stamp = Date.now();

const traveler = { name: 'Ayesha Khan', email: `trav.${stamp}@routelink.test`, password: 'hunter2secret' };
const guideUser = { name: 'Karim Shah', email: `guide.${stamp}@routelink.test`, password: 'hunter2secret', role: 'guide' };
const outsider = { name: 'Nadia Malik', email: `out.${stamp}@routelink.test`, password: 'hunter2secret' };
const adminUser = { name: 'Ops Admin', email: `admin.${stamp}@routelink.test`, password: 'hunter2secret' };

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

async function call(method, path, { token, body, rawBody, ingestKey } = {}) {
  const headers = {};
  if (body !== undefined || rawBody !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (ingestKey) {
    headers['X-Ingest-Key'] = ingestKey;
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
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${label}`);
  console.log(`  -> ${method} ${path}${opts.token ? '   [auth]' : (opts.ingestKey ? '   [ingest-key]' : '   [no auth]')}`);
  if (opts.body !== undefined) {
    console.log(`     body: ${render(opts.body, 240)}`);
  }
  console.log(`  <- ${res.status}`);
  console.log(`     ${render(projectSafely(project, res.body)).split('\n').join('\n     ')}`);
  return res;
}

function assert(label, condition, evidence) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(label);
  }
  console.log(`\n[${condition ? 'PASS' : 'FAIL'}] ${label}`);
  if (evidence !== undefined) {
    console.log(`     ${render(evidence, 300)}`);
  }
}

function section(title) {
  console.log(`\n\n${'='.repeat(74)}\n${title}\n${'='.repeat(74)}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  if (!INGEST_KEY) {
    console.error('HAZARD_INGEST_KEY is not set in the environment - the hazard ingest section cannot run.');
    process.exit(1);
  }

  section('SETUP - ACCOUNTS');
  const travelerRes = await step('signup traveler', 201, 'POST', '/api/auth/signup', { body: traveler },
    (b) => ({ id: b.user.id, role: b.user.role }));
  const guideRes = await step('signup user with role=guide', 201, 'POST', '/api/auth/signup', { body: guideUser },
    (b) => ({ id: b.user.id, role: b.user.role }));
  const outsiderRes = await step('signup unrelated third party', 201, 'POST', '/api/auth/signup', { body: outsider },
    (b) => ({ id: b.user.id, role: b.user.role }));
  await step('signup admin (role granted in DB, not via API)', 201, 'POST', '/api/auth/signup', { body: adminUser },
    (b) => ({ id: b.user.id, role: b.user.role }));

  await step('FAILURE signup cannot self-assign admin role', 400, 'POST', '/api/auth/signup',
    { body: { name: 'Sneaky', email: `sneaky.${stamp}@routelink.test`, password: 'hunter2secret', role: 'admin' } });

  await User.update({ role: 'admin' }, { where: { email: adminUser.email.toLowerCase() } });
  const adminLogin = await call('POST', '/api/auth/login', { body: { email: adminUser.email, password: adminUser.password } });
  assert('admin promoted in DB and re-issued token with role=admin', adminLogin.body.user.role === 'admin',
    { role: adminLogin.body.user.role });

  const travelerToken = travelerRes.body.token;
  const guideToken = guideRes.body.token;
  const outsiderToken = outsiderRes.body.token;
  const adminToken = adminLogin.body.token;
  const guideUserId = guideRes.body.user.id;

  section('1. GUIDE MARKETPLACE');
  await step('browse guides with NO auth (public)', 200, 'GET', '/api/guides', {},
    (b) => ({ count: b.count, filters: b.filters }));

  await step('FAILURE traveler role cannot create a guide listing', 403, 'POST', '/api/guides', {
    token: travelerToken,
    body: { region: 'Hunza', languages: ['Urdu'], pricePerDay: 5000 },
  });

  const guideCreate = await step('guide role creates listing', 201, 'POST', '/api/guides', {
    token: guideToken,
    body: {
      region: 'Hunza Valley',
      languages: ['Urdu', 'Burushaski', 'English'],
      bio: 'Ten seasons guiding treks around Hunza and Nagar.',
      phone: '+92 300 1234567',
      pricePerDay: 7500,
    },
  });
  const guideId = guideCreate.body.guide.id;

  await step('FAILURE same account cannot create a second listing', 409, 'POST', '/api/guides', {
    token: guideToken,
    body: { region: 'Skardu', languages: ['Balti'], pricePerDay: 6000 },
  });
  await step('FAILURE create listing with missing/invalid fields', 400, 'POST', '/api/guides', {
    token: guideToken,
    body: { region: '', languages: [], pricePerDay: 'free' },
  });
  await step('FAILURE create listing with no token', 401, 'POST', '/api/guides', {
    body: { region: 'Hunza', languages: ['Urdu'], pricePerDay: 100 },
  });

  await step('filter by region (public)', 200, 'GET', '/api/guides?region=hunza', {},
    (b) => ({ count: b.count, filters: b.filters, regions: b.guides.map((g) => g.region) }));
  await step('filter by language, case-insensitive (public)', 200, 'GET', '/api/guides?language=burushaski', {},
    (b) => ({ count: b.count, filters: b.filters, languages: b.guides.map((g) => g.languages) }));
  await step('filter with no matches returns empty list not 404', 200, 'GET', '/api/guides?region=Atlantis', {},
    (b) => ({ count: b.count, guides: b.guides }));

  await step('single guide profile with linked user (public)', 200, 'GET', `/api/guides/${guideId}`, {});
  await step('FAILURE unknown guide id', 404, 'GET', '/api/guides/11111111-2222-3333-4444-555555555555', {});
  await step('FAILURE malformed guide id is 400 not 500', 400, 'GET', '/api/guides/not-a-uuid', {});

  await step('owner patches own listing', 200, 'PATCH', `/api/guides/${guideId}`, {
    token: guideToken,
    body: { pricePerDay: 8200, isAvailable: true, bio: 'Updated: winter routes now available.' },
  }, (b) => ({ updated: b.updated, pricePerDay: b.guide.pricePerDay, bio: b.guide.bio }));
  await step("FAILURE another user cannot patch someone else's listing", 403, 'PATCH', `/api/guides/${guideId}`, {
    token: outsiderToken,
    body: { pricePerDay: 1 },
  });
  await step('FAILURE patch with no updatable fields', 400, 'PATCH', `/api/guides/${guideId}`, {
    token: guideToken,
    body: { nonsense: true },
  });

  const profile = await call('GET', `/api/guides/${guideId}`);
  assert('public guide profile exposes user name but NOT email',
    profile.body.guide.user.name === guideUser.name && !JSON.stringify(profile.body).includes(guideUser.email.toLowerCase()),
    { user: profile.body.guide.user });
  assert('anonymous read hides the phone number',
    profile.body.guide.phone === undefined,
    { phone: profile.body.guide.phone });

  const ownerRead = await call('GET', `/api/guides/${guideId}`, { token: guideToken });
  assert('owner reading their own listing DOES see the phone number',
    ownerRead.body.guide.phone === '+92 300 1234567',
    { phone: ownerRead.body.guide.phone });

  const outsiderRead = await call('GET', `/api/guides/${guideId}`, { token: outsiderToken });
  assert('another logged-in user still cannot see the phone number',
    outsiderRead.body.guide.phone === undefined,
    { phone: outsiderRead.body.guide.phone });

  const adminRead = await call('GET', `/api/guides/${guideId}`, { token: adminToken });
  assert('admin can see the phone number',
    adminRead.body.guide.phone === '+92 300 1234567',
    { phone: adminRead.body.guide.phone });

  section('2. BOOKINGS');
  const trip = await call('POST', '/api/trips', {
    token: travelerToken,
    body: { title: 'Hunza Autumn Trek', destination: 'Hunza Valley', startDate: '2026-10-05', endDate: '2026-10-09' },
  });
  const tripId = trip.body.trip.id;
  console.log(`\n[setup] traveler trip created: ${tripId}`);

  const outsiderTrip = await call('POST', '/api/trips', {
    token: outsiderToken,
    body: { title: 'Someone Elses Trip', destination: 'Skardu', startDate: '2026-11-01', endDate: '2026-11-03' },
  });

  await step('FAILURE create booking with no token', 401, 'POST', '/api/bookings', {
    body: { tripId, guideId, startDate: '2026-10-05', endDate: '2026-10-07' },
  });

  const booking = await step('traveler creates booking (status defaults to requested)', 201, 'POST', '/api/bookings', {
    token: travelerToken,
    body: { tripId, guideId, startDate: '2026-10-05', endDate: '2026-10-07' },
  });
  const bookingId = booking.body.booking.id;
  assert('new booking status is "requested"', booking.body.booking.status === 'requested',
    { status: booking.body.booking.status, totalPrice: booking.body.booking.totalPrice, days: booking.body.days });

  await step("FAILURE cannot book against another user's trip", 404, 'POST', '/api/bookings', {
    token: travelerToken,
    body: { tripId: outsiderTrip.body.trip.id, guideId, startDate: '2026-11-01', endDate: '2026-11-02' },
  });
  await step('FAILURE unknown guideId', 404, 'POST', '/api/bookings', {
    token: travelerToken,
    body: { tripId, guideId: '11111111-2222-3333-4444-555555555555', startDate: '2026-10-05', endDate: '2026-10-06' },
  });
  await step('FAILURE missing required booking fields', 400, 'POST', '/api/bookings', {
    token: travelerToken,
    body: { tripId },
  });
  await step('FAILURE endDate before startDate', 400, 'POST', '/api/bookings', {
    token: travelerToken,
    body: { tripId, guideId, startDate: '2026-10-09', endDate: '2026-10-05' },
  });

  await step('traveler lists own bookings', 200, 'GET', '/api/bookings', { token: travelerToken },
    (b) => ({ count: b.count, bookings: b.bookings.map((x) => ({ id: x.id, status: x.status, guide: x.guide.name, trip: x.trip.title })) }));
  await step('unrelated user sees none of them', 200, 'GET', '/api/bookings', { token: outsiderToken },
    (b) => ({ count: b.count, bookings: b.bookings }));

  await step('FAILURE traveler cannot confirm their own booking', 403, 'PATCH', `/api/bookings/${bookingId}/status`, {
    token: travelerToken,
    body: { status: 'confirmed' },
  });
  await step('FAILURE unrelated user gets 404, not 403 (no existence leak)', 404, 'PATCH', `/api/bookings/${bookingId}/status`, {
    token: outsiderToken,
    body: { status: 'confirmed' },
  });
  await step('FAILURE invalid status value', 400, 'PATCH', `/api/bookings/${bookingId}/status`, {
    token: guideToken,
    body: { status: 'teleported' },
  });
  await step('assigned guide confirms the booking', 200, 'PATCH', `/api/bookings/${bookingId}/status`, {
    token: guideToken,
    body: { status: 'confirmed' },
  }, (b) => ({ previousStatus: b.previousStatus, status: b.booking.status, changedBy: b.changedBy }));
  await step('admin can also change status', 200, 'PATCH', `/api/bookings/${bookingId}/status`, {
    token: adminToken,
    body: { status: 'completed' },
  }, (b) => ({ previousStatus: b.previousStatus, status: b.booking.status, changedBy: b.changedBy }));

  section('3. HAZARD ALERTS');
  const landslideText = `Heavy landslide has blocked the Karakoram Highway near Aliabad, traffic halted both directions since morning. [${stamp}]`;
  const landslidePayload = {
    sourceType: 'twitter',
    rawText: landslideText,
    hazardType: 'natural_disaster',
    region: 'Gilgit-Baltistan',
    latitude: 36.3167,
    longitude: 74.6667,
    severity: 'high',
  };

  await step('FAILURE ingest with no service key', 401, 'POST', '/api/hazards', { body: landslidePayload });
  await step('FAILURE ingest with wrong service key', 401, 'POST', '/api/hazards', {
    body: landslidePayload,
    ingestKey: `${INGEST_KEY}-wrong`,
  });

  const hazard = await step('NLP pipeline ingests an alert with service key', 201, 'POST', '/api/hazards', {
    body: landslidePayload,
    ingestKey: INGEST_KEY,
  }, (b) => b.alert);
  assert('title was derived from rawText (model requires NOT NULL title)',
    typeof hazard.body.alert.title === 'string' && hazard.body.alert.title.length > 0,
    { title: hazard.body.alert.title });

  const duplicate = await step('re-ingesting the same alert is deduped, not duplicated', 200, 'POST', '/api/hazards', {
    body: landslidePayload,
    ingestKey: INGEST_KEY,
  }, (b) => ({ duplicate: b.duplicate, id: b.alert.id }));
  assert('dedupe returns the original row', duplicate.body.duplicate === true && duplicate.body.alert.id === hazard.body.alert.id,
    { first: hazard.body.alert.id, second: duplicate.body.alert.id });

  await step('second alert, different region/severity', 201, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: {
      sourceType: 'news_rss',
      rawText: `Flash flood warning issued for Swat river basin over the next 48 hours. [${stamp}]`,
      hazardType: 'weather',
      region: 'Khyber Pakhtunkhwa',
      severity: 'critical',
    },
  }, (b) => ({ id: b.alert.id, severity: b.alert.severity, region: b.alert.region }));

  await step('FAILURE invalid hazardType enum', 400, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: { sourceType: 'twitter', rawText: 'something happened', hazardType: 'alien_invasion', region: 'Hunza', severity: 'high' },
  });
  await step('FAILURE invalid severity enum', 400, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: { sourceType: 'twitter', rawText: 'something happened', hazardType: 'safety', region: 'Hunza', severity: 'apocalyptic' },
  });
  await step('FAILURE missing every required field', 400, 'POST', '/api/hazards', { ingestKey: INGEST_KEY, body: {} });
  await step('FAILURE latitude out of range', 400, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: { sourceType: 'sensor', rawText: 'x', hazardType: 'weather', region: 'Hunza', severity: 'low', latitude: 999, longitude: 74 },
  });
  await step('FAILURE latitude without longitude', 400, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: { sourceType: 'sensor', rawText: 'x', hazardType: 'weather', region: 'Hunza', severity: 'low', latitude: 36.1 },
  });
  await step('FAILURE unexpected field rejected (strict ingest)', 400, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: { sourceType: 'twitter', rawText: 'x', hazardType: 'weather', region: 'Hunza', severity: 'low', hazrdType: 'typo' },
  });

  await step('Mobile/Integration read alerts with NO auth', 200, 'GET', '/api/hazards', {},
    (b) => ({ count: b.count, alerts: b.alerts.map((a) => ({ severity: a.severity, region: a.region, hazardType: a.hazardType })) }));
  await step('filter alerts by region (public)', 200, 'GET', '/api/hazards?region=gilgit', {},
    (b) => ({ count: b.count, region: b.region, alerts: b.alerts.map((a) => ({ region: a.region, title: a.title })) }));
  await step('region with no alerts returns empty list', 200, 'GET', '/api/hazards?region=Atlantis', {},
    (b) => ({ count: b.count, alerts: b.alerts }));

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
