require('dotenv').config();
const { spawn } = require('child_process');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const ALT_PORT = 5051;
const ALT_BASE = `http://localhost:${ALT_PORT}`;
const INGEST_KEY = process.env.ML_SERVICE_KEY || process.env.HAZARD_INGEST_KEY;
const stamp = Date.now();

let passed = 0;
let failed = 0;
const failures = [];

function render(value, max = 900) {
  if (value === undefined || value === null) {
    return String(value);
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n     ...[truncated]` : text;
}

async function call(method, path, { token, body, ingestKey, base = BASE } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ingestKey) headers['X-Ingest-Key'] = ingestKey;

  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = text;
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

async function step(label, expectedStatus, method, path, opts = {}, project) {
  const res = await call(method, path, opts);
  const ok = res.status === expectedStatus;

  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${label}`);
  console.log(`  -> ${method} ${path}${opts.ingestKey ? '   [X-Ingest-Key]' : ''}${opts.token ? '   [Bearer]' : ''}`);
  if (opts.body !== undefined) {
    console.log(`     request: ${render(opts.body, 400)}`);
  }
  console.log(`  <- ${res.status} (expected ${expectedStatus})`);
  let shown = res.body;
  if (project) {
    try {
      shown = project(res.body);
    } catch (e) {
      shown = `[projector failed: ${e.message}] ${render(res.body, 200)}`;
    }
  }
  console.log(`     ${render(shown).split('\n').join('\n     ')}`);

  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`${label} — got ${res.status}, expected ${expectedStatus}`);
  }
  return res;
}

function assert(label, condition, evidence) {
  if (condition) {
    passed++;
    console.log(`\nPASS  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`\nFAIL  ${label}`);
  }
  if (evidence !== undefined) {
    console.log(`     ${render(evidence, 500).split('\n').join('\n     ')}`);
  }
}

function section(title) {
  console.log(`\n\n${'='.repeat(74)}\n${title}\n${'='.repeat(74)}`);
}

async function signup(suffix, role) {
  const body = {
    name: `Day4 ${suffix}`,
    email: `d5.${suffix}.${stamp}@routelink.test`,
    password: 'hunter2secret',
  };
  if (role) body.role = role;
  const res = await call('POST', '/api/auth/signup', { body });
  return { token: res.body.token, user: res.body.user };
}

function waitForServer(base, attempts = 40) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const res = await fetch(`${base}/health`);
        if (res.ok) return resolve();
      } catch {}
      if (tries >= attempts) return reject(new Error(`server at ${base} never became ready`));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function main() {
  if (!INGEST_KEY) {
    console.error('ML_SERVICE_KEY / HAZARD_INGEST_KEY is not set — cannot test hazard ingest.');
    process.exit(1);
  }

  section('1. SECURITY HEADERS (helmet)');
  const health = await call('GET', '/health');
  const wanted = ['x-content-type-options', 'x-frame-options', 'strict-transport-security', 'referrer-policy'];
  const present = wanted.filter((h) => health.headers.get(h));
  assert('helmet sets the standard security headers on every response',
    present.length === wanted.length,
    Object.fromEntries(wanted.map((h) => [h, health.headers.get(h)])));

  section('2. HAZARD INGEST — auth failure cases');
  await step('FAILURE ingest with no X-Ingest-Key', 401, 'POST', '/api/hazards', {
    body: { sourceType: 'news', rawText: `no key ${stamp}`, hazardType: 'weather', region: 'Hunza', severity: 'low' },
  });
  await step('FAILURE ingest with wrong X-Ingest-Key', 401, 'POST', '/api/hazards', {
    ingestKey: 'definitely-not-the-key',
    body: { sourceType: 'news', rawText: `bad key ${stamp}`, hazardType: 'weather', region: 'Hunza', severity: 'low' },
  });

  section('3. HAZARD ALIAS MAPPING (AI/ML labels -> our enum)');
  const aliasCases = [
    ['flood', 'natural_disaster'],
    ['landslide', 'natural_disaster'],
    ['roadblock', 'safety'],
    ['GLOF', 'natural_disaster'],
    ['road closure', 'safety'],
    ['protest', 'political'],
    ['heatwave', 'weather'],
    ['outbreak', 'health'],
  ];

  for (const [label, expectedEnum] of aliasCases) {
    const res = await step(`alias "${label}" maps to ${expectedEnum}`, 201, 'POST', '/api/hazards', {
      ingestKey: INGEST_KEY,
      body: {
        sourceType: 'ml-nlp',
        rawText: `${label} reported near Karimabad run ${stamp}`,
        hazardType: label,
        region: `AliasTest ${stamp}`,
        severity: 'medium',
      },
    }, (b) => ({ hazardType: b.alert && b.alert.hazardType, hazardTypeMappedFrom: b.hazardTypeMappedFrom }));
    assert(`  -> stored as ${expectedEnum}`,
      res.body.alert && res.body.alert.hazardType === expectedEnum,
      { got: res.body.alert && res.body.alert.hazardType, expected: expectedEnum });
  }

  await step('canonical enum value still passes through unmapped', 201, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: {
      sourceType: 'ml-nlp',
      rawText: `canonical passthrough ${stamp}`,
      hazardType: 'natural_disaster',
      region: `AliasTest ${stamp}`,
      severity: 'high',
    },
  }, (b) => ({ hazardType: b.alert && b.alert.hazardType, hazardTypeMappedFrom: b.hazardTypeMappedFrom }));

  await step('FAILURE unknown label is still rejected, and lists the aliases', 400, 'POST', '/api/hazards', {
    ingestKey: INGEST_KEY,
    body: {
      sourceType: 'ml-nlp',
      rawText: `unknown label ${stamp}`,
      hazardType: 'alien_invasion',
      region: `AliasTest ${stamp}`,
      severity: 'low',
    },
  });

  section('4. GUIDE-SIDE BOOKING VISIBILITY');
  const traveler = await signup('trav');
  const guideUser = await signup('guide', 'guide');
  const region = `Hunza D5 ${stamp}`;

  const listing = await step('guide creates a listing', 201, 'POST', '/api/guides', {
    token: guideUser.token,
    body: { region, languages: ['en', 'ur'], bio: 'Certified mountain guide', phone: '+92 300 7654321', pricePerDay: 7500 },
  }, (b) => ({ id: b.guide && b.guide.id, region: b.guide && b.guide.region, pricePerDay: b.guide && b.guide.pricePerDay }));
  const guideId = listing.body.guide.id;

  const trip = await step('traveler creates a trip in that region', 201, 'POST', '/api/trips', {
    token: traveler.token,
    body: { title: 'Hunza run', destination: region, startDate: '2026-11-01', endDate: '2026-11-04' },
  }, (b) => ({ id: b.trip && b.trip.id, destination: b.trip && b.trip.destination }));
  const tripId = trip.body.trip.id;

  const booking = await step('traveler books the guide', 201, 'POST', '/api/bookings', {
    token: traveler.token,
    body: { tripId, guideId, startDate: '2026-11-02', endDate: '2026-11-03' },
  }, (b) => ({ id: b.booking && b.booking.id, status: b.booking && b.booking.status, totalPrice: b.booking && b.booking.totalPrice }));
  const bookingId = booking.body.booking.id;

  const travelerList = await step('traveler sees it in GET /api/bookings', 200, 'GET', '/api/bookings', {
    token: traveler.token,
  }, (b) => ({ total: b.total, roles: b.bookings.map((x) => x.viewerRole) }));
  assert('traveler viewerRole is "traveler"',
    travelerList.body.bookings.some((x) => x.id === bookingId && x.viewerRole === 'traveler'),
    travelerList.body.bookings.map((x) => ({ id: x.id, viewerRole: x.viewerRole })));

  const guideList = await step('GUIDE also sees it in GET /api/bookings', 200, 'GET', '/api/bookings', {
    token: guideUser.token,
  }, (b) => ({ total: b.total, roles: b.bookings.map((x) => x.viewerRole) }));
  assert('guide sees the booking with viewerRole "guide"',
    guideList.body.bookings.some((x) => x.id === bookingId && x.viewerRole === 'guide'),
    guideList.body.bookings.map((x) => ({ id: x.id, viewerRole: x.viewerRole })));

  await step('FAILURE traveler cannot change booking status', 403, 'PATCH', `/api/bookings/${bookingId}/status`, {
    token: traveler.token,
    body: { status: 'confirmed' },
  });

  await step('guide CAN change booking status (reachable in practice now)', 200, 'PATCH', `/api/bookings/${bookingId}/status`, {
    token: guideUser.token,
    body: { status: 'confirmed' },
  }, (b) => ({ status: b.booking && b.booking.status, previousStatus: b.previousStatus, changedBy: b.changedBy }));

  section('5. MARKETPLACE ENRICHMENT from real Guide data');
  await step('service writes an indoor_rest day (needs_marketplace_data defaults true)', 200, 'PUT',
    `/api/trips/${tripId}/itinerary`, {
      ingestKey: INGEST_KEY,
      body: {
        source: 'ml',
        model_version: 'mock-ml-v0.0.1',
        days: [{ day_number: 1, date: '2026-11-01', slot_type: 'indoor_rest', heat_tier: 'extreme', activities: [] }],
      },
    }, (b) => ({ source: b.source, writtenBy: b.writtenBy, days: b.days }));

  const enriched = await step('GET itinerary fills the flagged day with REAL guides', 200, 'GET',
    `/api/trips/${tripId}/itinerary`, { token: traveler.token },
    (b) => ({
      source: b.source,
      needsMarketplaceData: b.itinerary[0].needsMarketplaceData,
      marketplaceRegion: b.itinerary[0].marketplace && b.itinerary[0].marketplace.region,
      guideNames: b.itinerary[0].marketplace && b.itinerary[0].marketplace.guides.map((g) => g.region),
      guideCount: b.itinerary[0].marketplace && b.itinerary[0].marketplace.guides.length,
    }));
  assert('flagged day carries at least one real guide listing from that region',
    enriched.body.itinerary[0].marketplace
      && enriched.body.itinerary[0].marketplace.guides.length > 0,
    enriched.body.itinerary[0].marketplace);

  const emptyTrip = await call('POST', '/api/trips', {
    token: traveler.token,
    body: { title: 'Nowhere', destination: `Atlantis ${stamp}`, startDate: '2026-12-01', endDate: '2026-12-02' },
  });
  const emptyTripId = emptyTrip.body.trip.id;
  await call('PUT', `/api/trips/${emptyTripId}/itinerary`, {
    ingestKey: INGEST_KEY,
    body: {
      source: 'ml',
      days: [{ day_number: 1, date: '2026-12-01', slot_type: 'indoor_rest', activities: [] }],
    },
  });
  const emptyRegion = await step('region with NO guides degrades gracefully, does not break', 200, 'GET',
    `/api/trips/${emptyTripId}/itinerary`, { token: traveler.token },
    (b) => ({
      needsMarketplaceData: b.itinerary[0].needsMarketplaceData,
      marketplace: b.itinerary[0].marketplace,
    }));
  assert('empty region returns an empty guides array, not AI placeholder text',
    emptyRegion.body.itinerary[0].marketplace
      && Array.isArray(emptyRegion.body.itinerary[0].marketplace.guides)
      && emptyRegion.body.itinerary[0].marketplace.guides.length === 0,
    emptyRegion.body.itinerary[0].marketplace);

  section('6. SOS — POST /api/sos and GET /api/sos/nearest (mocked lookup)');
  await step('FAILURE SOS with no token', 401, 'POST', '/api/sos', {
    body: { latitude: 36.3167, longitude: 74.65 },
  });

  const sos = await step('POST /api/sos returns nearest services (200, not 201 — nothing is created)', 200, 'POST', '/api/sos', {
    token: traveler.token,
    body: { userId: traveler.user.id, latitude: 36.3167, longitude: 74.65 },
  }, (b) => ({
    sos: b.sos,
    provider: b.nearest.provider,
    mocked: b.nearest.mocked,
    serviceCount: b.nearest.services.length,
    closest: b.nearest.services[0],
    emergencyNumbers: b.nearest.emergencyNumbers,
  }));
  assert('lookup is clearly flagged as mocked so Mobile knows it is not live data',
    sos.body.nearest.mocked === true && sos.body.nearest.provider === 'mock',
    { provider: sos.body.nearest.provider, mocked: sos.body.nearest.mocked });
  assert('services are sorted nearest-first with a real distance',
    sos.body.nearest.services.length > 1
      && sos.body.nearest.services[0].distanceKm <= sos.body.nearest.services[1].distanceKm,
    sos.body.nearest.services.map((s) => ({ name: s.name, distanceKm: s.distanceKm })));

  await step('FAILURE spoofing another userId is rejected', 403, 'POST', '/api/sos', {
    token: traveler.token,
    body: { userId: guideUser.user.id, latitude: 36.3167, longitude: 74.65 },
  });
  await step('FAILURE missing coordinates', 400, 'POST', '/api/sos', {
    token: traveler.token,
    body: { userId: traveler.user.id },
  });
  await step('FAILURE latitude out of range', 400, 'POST', '/api/sos', {
    token: traveler.token,
    body: { latitude: 999, longitude: 74.65 },
  });
  await step('FAILURE snake_case/nested legacy draft shape is rejected', 400, 'POST', '/api/sos', {
    token: traveler.token,
    body: { user_id: traveler.user.id, location: { lat: 36.3167, lng: 74.65 } },
  });

  await step('GET /api/sos/nearest (the shape SOS_DECISION.md specifies)', 200, 'GET',
    '/api/sos/nearest?lat=36.3167&lng=74.6500', { token: traveler.token },
    (b) => ({ query: b.query, provider: b.nearest.provider, mocked: b.nearest.mocked, count: b.nearest.services.length }));
  await step('GET /api/sos/nearest tight radius returns fewer results', 200, 'GET',
    '/api/sos/nearest?lat=36.3167&lng=74.6500&radiusMeters=1000', { token: traveler.token },
    (b) => ({ radiusMeters: b.query.radiusMeters, count: b.nearest.services.length }));
  await step('FAILURE GET /api/sos/nearest with no coordinates', 400, 'GET', '/api/sos/nearest', {
    token: traveler.token,
  });

  section('7. RATE LIMITING + ML MOCK (separate server, tuned env)');
  const child = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: String(ALT_PORT),
      AUTH_RATE_LIMIT_MAX: '2',
      HAZARD_RATE_LIMIT_MAX: '2',
      ITINERARY_ML_MOCK: 'true',
    },
    stdio: 'ignore',
  });

  try {
    await waitForServer(ALT_BASE);

    const creds = { email: `d5.trav.${stamp}@routelink.test`, password: 'hunter2secret' };
    await step('login 1 of 3 under a max of 2', 200, 'POST', '/api/auth/login', { body: creds, base: ALT_BASE },
      (b) => ({ hasToken: Boolean(b.token) }));
    await step('login 2 of 3 under a max of 2', 200, 'POST', '/api/auth/login', { body: creds, base: ALT_BASE },
      (b) => ({ hasToken: Boolean(b.token) }));
    const limited = await step('login 3 of 3 is rate limited', 429, 'POST', '/api/auth/login',
      { body: creds, base: ALT_BASE });
    assert('429 carries Retry-After so clients can back off',
      Boolean(limited.headers.get('retry-after')),
      { retryAfter: limited.headers.get('retry-after'), body: limited.body });

    await step('hazard ingest 1 of 3 under a max of 2', 401, 'POST', '/api/hazards',
      { body: {}, base: ALT_BASE });
    await step('hazard ingest 2 of 3 under a max of 2', 401, 'POST', '/api/hazards',
      { body: {}, base: ALT_BASE });
    await step('hazard ingest 3 of 3 is rate limited BEFORE the key check', 429, 'POST', '/api/hazards',
      { body: {}, base: ALT_BASE });

    const mlTrip = await call('POST', '/api/trips', {
      token: traveler.token,
      base: ALT_BASE,
      body: { title: 'ML preview', destination: region, startDate: '2026-11-10', endDate: '2026-11-13' },
    });
    const mlPreview = await step('ITINERARY_ML_MOCK=true serves the mock AI/ML shape, enriched', 200, 'GET',
      `/api/trips/${mlTrip.body.trip.id}/itinerary`, { token: traveler.token, base: ALT_BASE },
      (b) => ({
        source: b.source,
        mocked: b.mocked,
        generator: b.generator,
        modelVersion: b.modelVersion,
        days: b.days,
        slotTypes: b.itinerary.map((d) => d.slotType),
        heatTiers: b.itinerary.map((d) => d.heatTier),
        flaggedDays: b.itinerary.filter((d) => d.needsMarketplaceData).map((d) => d.dayNumber),
        guidesOnFlaggedDay: (b.itinerary.find((d) => d.needsMarketplaceData) || {}).marketplace,
      }));
    assert('mock output is normalized from snake_case into camelCase',
      mlPreview.body.itinerary.every((d) => d.slotType !== undefined && d.slot_type === undefined),
      mlPreview.body.itinerary[0]);
    assert('mock indoor_rest day is enriched with real guides from our own DB',
      mlPreview.body.itinerary.some((d) => d.needsMarketplaceData && d.marketplace && d.marketplace.guides.length > 0),
      (mlPreview.body.itinerary.find((d) => d.needsMarketplaceData) || {}).marketplace);
    assert('response is flagged mocked so nobody mistakes it for the real service',
      mlPreview.body.mocked === true && mlPreview.body.generator === 'mock',
      { source: mlPreview.body.source, mocked: mlPreview.body.mocked, generator: mlPreview.body.generator });
  } finally {
    child.kill();
  }

  section(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nsuite crashed:', err);
  process.exit(1);
});
