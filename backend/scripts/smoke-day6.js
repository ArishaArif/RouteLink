require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');
const mlClient = require('../services/mlClient');
const recommendationService = require('../services/recommendationService');
const { destinationId } = require('../utils/destinationIdentity');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const STUB_PORT = Number.parseInt(process.env.ML_STUB_PORT, 10) || 8099;
const STUB_URL = `http://localhost:${STUB_PORT}`;
const stamp = Date.now();

const traveler = { name: 'Areeba Khan', email: `d6.trav.${stamp}@routelink.test`, password: 'hunter2secret' };

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

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let parsed = null;
  try {
    parsed = await res.json();
  } catch (err) {
    parsed = null;
  }

  return { status: res.status, body: parsed };
}

function startStub() {
  const child = spawn(process.execPath, [path.join(__dirname, 'ml-stub.js')], {
    env: { ...process.env, ML_STUB_PORT: String(STUB_PORT) },
    stdio: 'ignore',
  });
  return child;
}

async function waitForStub(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${STUB_URL}/health`);
      if (res.ok) {
        return true;
      }
    } catch (err) {
      void err;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

function names(rows) {
  return rows.map((row) => row.name);
}

function lowerNames(rows) {
  return rows.map((row) => row.name.toLowerCase());
}

async function main() {
  console.log(`Day 6 smoke: recommendations bridge against ${BASE}`);

  const stub = startStub();
  const stubUp = await waitForStub();

  try {
    section('0. ML stub reachable');
    check('ML stub answers /health', stubUp, STUB_URL);

    section('1. Auth setup');
    const signup = await call('POST', '/api/auth/signup', { body: traveler });
    check('signup returns 201 with token', signup.status === 201 && Boolean(signup.body.token), signup.status);
    const token = signup.body.token;

    section('2. Endpoint contract and validation');
    const noAuth = await call('GET', '/api/recommendations?destination=Hunza%20Valley');
    check('unauthenticated request is rejected 401', noAuth.status === 401, noAuth.status);

    const missing = await call('GET', '/api/recommendations', { token });
    check('missing destination returns 400', missing.status === 400, missing.body);

    const blank = await call('GET', '/api/recommendations?destination=%20%20', { token });
    check('blank destination returns 400', blank.status === 400, blank.body);

    const overLimit = await call('GET', '/api/recommendations?destination=Hunza%20Valley&limit=99', { token });
    check('limit above max returns 400', overLimit.status === 400, overLimit.body);

    const badLimit = await call('GET', '/api/recommendations?destination=Hunza%20Valley&limit=abc', { token });
    check('non-numeric limit returns 400', badLimit.status === 400, badLimit.body);

    section('3. Mobile-consumable shape');
    const first = await call('GET', '/api/recommendations?destination=Hunza%20Valley', { token });
    check('returns 200 with a pool', first.status === 200 && Array.isArray(first.body.recommendations), first.status);
    check('count matches array length', first.body.count === first.body.recommendations.length, first.body.count);
    check('default pool size is 8', first.body.recommendations.length === 8, first.body.recommendations.length);
    check('origin destination is not recommended to itself',
      !lowerNames(first.body.recommendations).includes('hunza valley'),
      names(first.body.recommendations));

    const required = ['id', 'name', 'description', 'location', 'latitude', 'longitude', 'imageUrl'];
    const shapeOk = first.body.recommendations.every((row) => required.every((key) => key in row));
    check('every row carries the AttractionSpot keys Mobile renders', shapeOk, required.join(', '));
    check('ids are stable uuid v4-shaped values',
      first.body.recommendations.every((row) => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.id)),
      first.body.recommendations[0].id);
    check('id is deterministic for the same name',
      first.body.recommendations[0].id === destinationId(first.body.recommendations[0].name),
      first.body.recommendations[0].name);

    const limited = await call('GET', '/api/recommendations?destination=Hunza%20Valley&limit=3', { token });
    check('limit=3 returns exactly 3', limited.body.recommendations.length === 3, limited.body.recommendations.length);

    const wide = await call('GET', '/api/recommendations?destination=Hunza%20Valley&limit=20', { token });
    check('limit above the default pool size is not capped at 8',
      wide.body.recommendations.length > 8,
      wide.body.recommendations.length);
    check('limit is an upper bound and count reports what was served',
      wide.body.count === wide.body.recommendations.length && wide.body.count <= 20,
      { count: wide.body.count, requested: 20 });

    section('4. Exclude list is applied through the bridge');
    await call('POST', '/api/users/me/destination-state', { token, body: { destinationName: 'passu cones', status: 'visited' } });
    await call('POST', '/api/users/me/destination-state', { token, body: { destinationName: 'SKARDU', status: 'dismissed' } });

    const filtered = await call('GET', '/api/recommendations?destination=Hunza%20Valley', { token });
    check('excludeApplied echoes the stored names', filtered.body.excludeApplied.length === 2, filtered.body.excludeApplied);
    check('lowercase-stored name is excluded despite dataset casing',
      !lowerNames(filtered.body.recommendations).includes('passu cones'),
      names(filtered.body.recommendations));
    check('uppercase-stored name is excluded despite dataset casing',
      !lowerNames(filtered.body.recommendations).includes('skardu'),
      names(filtered.body.recommendations));
    check('no excluded name survives regardless of which recommender served the pool',
      lowerNames(filtered.body.recommendations).every((name) => name !== 'passu cones' && name !== 'skardu'),
      { source: filtered.body.source, names: names(filtered.body.recommendations) });
    check('no duplicate destinations in the pool',
      new Set(lowerNames(filtered.body.recommendations)).size === filtered.body.recommendations.length,
      names(filtered.body.recommendations));

    section('5. Degradation when ML is unavailable');
    const unknown = await call('GET', '/api/recommendations?destination=Atlantis', { token });
    check('unknown destination still returns 200', unknown.status === 200, unknown.status);
    check('unknown destination falls back to mock with a stated reason',
      unknown.body.source === 'mock' && typeof unknown.body.reason === 'string',
      { source: unknown.body.source, degraded: unknown.body.degraded, reason: unknown.body.reason });
    check('unknown destination still yields a usable pool', unknown.body.recommendations.length > 0, unknown.body.count);

    section('6. Service-level fallback behaviour');
    const savedUrl = process.env.ML_SERVICE_URL;

    delete process.env.ML_SERVICE_URL;
    check('mlClient reports not configured when ML_SERVICE_URL is empty', mlClient.isConfigured() === false, mlClient.baseUrl());
    const unconfigured = await recommendationService.getRecommendations('Hunza Valley', { exclude: [] });
    check('unconfigured ML falls back to mock without degrading',
      unconfigured.source === 'mock' && unconfigured.degraded === false && unconfigured.reason === 'ml_service_not_configured',
      { source: unconfigured.source, reason: unconfigured.reason });
    check('mock fallback pool is non-empty', unconfigured.recommendations.length > 0, unconfigured.recommendations.length);
    check('mock fallback honours the exclude list',
      !lowerNames((await recommendationService.getRecommendations('Hunza Valley', { exclude: ['fairy meadows'] })).recommendations)
        .includes('fairy meadows'),
      'fairy meadows excluded');

    process.env.ML_SERVICE_URL = 'http://localhost:8098';
    const unreachable = await recommendationService.getRecommendations('Hunza Valley', { exclude: [] });
    check('unreachable ML degrades to mock rather than throwing',
      unreachable.source === 'mock' && unreachable.degraded === true && unreachable.reason === 'unreachable',
      { source: unreachable.source, reason: unreachable.reason });
    check('degraded pool is still usable', unreachable.recommendations.length > 0, unreachable.recommendations.length);

    process.env.ML_SERVICE_URL = STUB_URL;
    const live = await recommendationService.getRecommendations('Hunza Valley', { exclude: [] });
    check('configured ML is used and reported as source ml',
      live.source === 'ml' && live.mocked === false && live.degraded === false,
      { source: live.source, mocked: live.mocked });
    check('ML rows are mapped to the AttractionSpot shape',
      live.recommendations.every((row) => typeof row.id === 'string' && typeof row.description === 'string'),
      live.recommendations[0]);
    check('ML exclude travels upstream and is honoured case-insensitively',
      !lowerNames((await recommendationService.getRecommendations('Hunza Valley', { exclude: ['PASSU CONES'] })).recommendations)
        .includes('passu cones'),
      'PASSU CONES excluded from a catalog storing "Passu Cones"');

    const offCatalog = await recommendationService.getRecommendations('Atlantis', { exclude: [] });
    check('catalog miss against a live ML service reports not_in_catalog',
      offCatalog.source === 'mock' && offCatalog.degraded === true && offCatalog.reason === 'not_in_catalog',
      { source: offCatalog.source, reason: offCatalog.reason });

    process.env.ML_SERVICE_URL = savedUrl;

    section('7. Itinerary carries the pool on both branches');
    const trip = await call('POST', '/api/trips', {
      token,
      body: { title: 'Day 6 check', destination: 'Hunza Valley', startDate: '2026-10-01', endDate: '2026-10-03' },
    });
    check('trip created', trip.status === 201, trip.status);

    const itinerary = await call('GET', `/api/trips/${trip.body.trip.id}/itinerary`, { token });
    check('itinerary returns 200', itinerary.status === 200, itinerary.status);
    check('placeholder branch now exposes recommendationPool',
      Array.isArray(itinerary.body.recommendationPool),
      itinerary.body.source);
    check('placeholder branch exposes excludeApplied',
      Array.isArray(itinerary.body.excludeApplied) && itinerary.body.excludeApplied.length === 2,
      itinerary.body.excludeApplied);
    check('itinerary pool respects the exclude list',
      !lowerNames(itinerary.body.recommendationPool).includes('skardu'),
      names(itinerary.body.recommendationPool));
    check('itinerary reports which recommender served the pool',
      typeof itinerary.body.recommendationSource === 'string',
      itinerary.body.recommendationSource);

    section('8. Isolation between users');
    const second = { name: 'Zara Malik', email: `d6.other.${stamp}@routelink.test`, password: 'hunter2secret' };
    const secondSignup = await call('POST', '/api/auth/signup', { body: second });
    const secondPool = await call('GET', '/api/recommendations?destination=Hunza%20Valley', { token: secondSignup.body.token });
    check('a different user sees no inherited exclusions',
      secondPool.body.excludeApplied.length === 0 && secondPool.body.recommendations.length === 8,
      { excludeApplied: secondPool.body.excludeApplied, count: secondPool.body.count });
  } finally {
    stub.kill();
  }

  section('SUMMARY');
  console.log(`\npassed: ${passed}`);
  console.log(`failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\nfailures:');
    failures.forEach((label) => console.log(`  - ${label}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nsmoke run crashed:', err);
  process.exit(1);
});
