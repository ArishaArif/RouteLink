require('dotenv').config();

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const SERVICE_KEY = process.env.ML_SERVICE_KEY || process.env.HAZARD_INGEST_KEY;
const stamp = Date.now();

const traveler = { name: 'Ayesha Khan', email: `d4.trav.${stamp}@routelink.test`, password: 'hunter2secret' };
const guideUser = { name: 'Karim Shah', email: `d4.guide.${stamp}@routelink.test`, password: 'hunter2secret', role: 'guide' };
const outsider = { name: 'Nadia Malik', email: `d4.out.${stamp}@routelink.test`, password: 'hunter2secret' };

const FALLBACK_MESSAGE = 'Outdoor activity is unsafe at this heat tier. See the Guide Marketplace for verified options.';
const MODEL_VERSION = 'heat-sched-v0.3.1';
const REGION = `Hunza Valley QA${stamp}`;
const GUIDE_PHONE = '+92 300 7654321';

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

async function call(method, path, { token, body, serviceKey } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (serviceKey) {
    headers['X-Ingest-Key'] = serviceKey;
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
  const credential = opts.token ? '   [auth]' : (opts.serviceKey ? '   [service-key]' : '   [no auth]');
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${label}`);
  console.log(`  -> ${method} ${path}${credential}`);
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
    console.log(`     ${render(evidence, 400)}`);
  }
}

function section(title) {
  console.log(`\n\n${'='.repeat(74)}\n${title}\n${'='.repeat(74)}`);
}

function dayByNumber(payload, dayNumber) {
  return payload.itinerary.find((day) => day.dayNumber === dayNumber);
}

(async () => {
  if (!SERVICE_KEY) {
    console.error('Neither ML_SERVICE_KEY nor HAZARD_INGEST_KEY is set - the itinerary write section cannot run.');
    process.exit(1);
  }

  section('SETUP - ACCOUNTS, GUIDE LISTING, TRIP');
  const travelerRes = await call('POST', '/api/auth/signup', { body: traveler });
  const guideRes = await call('POST', '/api/auth/signup', { body: guideUser });
  const outsiderRes = await call('POST', '/api/auth/signup', { body: outsider });

  const travelerToken = travelerRes.body.token;
  const guideToken = guideRes.body.token;
  const outsiderToken = outsiderRes.body.token;

  const listing = await call('POST', '/api/guides', {
    token: guideToken,
    body: {
      region: REGION,
      languages: ['Urdu', 'Burushaski'],
      bio: 'Indoor heritage tours and winter routes.',
      phone: GUIDE_PHONE,
      pricePerDay: 7500,
    },
  });
  console.log(`[setup] guide listing: ${listing.body.guide.id} (${listing.body.guide.region})`);

  const tripRes = await call('POST', '/api/trips', {
    token: travelerToken,
    body: {
      title: 'Hunza Heat-Aware Run',
      destination: REGION,
      startDate: '2026-10-05',
      endDate: '2026-10-08',
    },
  });
  const tripId = tripRes.body.trip.id;
  console.log(`[setup] trip: ${tripId}`);

  const outsiderTrip = await call('POST', '/api/trips', {
    token: outsiderToken,
    body: { title: 'Other Trip', destination: 'Skardu', startDate: '2026-11-01', endDate: '2026-11-02' },
  });

  section('1. PLACEHOLDER SHAPE BEFORE ANY WRITE');
  const placeholder = await step('GET itinerary falls back to placeholder', 200, 'GET', `/api/trips/${tripId}/itinerary`,
    { token: travelerToken },
    (b) => ({ source: b.source, days: b.days, firstDay: b.itinerary[0] }));
  assert('placeholder reports source=placeholder', placeholder.body.source === 'placeholder',
    { source: placeholder.body.source });
  assert('placeholder days carry the new contract fields as nulls, not missing keys',
    placeholder.body.itinerary.every((day) => day.slotType === null
      && day.heatTier === null
      && day.needsMarketplaceData === false
      && day.fallbackMessage === null
      && day.hazardContext === null),
    placeholder.body.itinerary[0]);

  section('2. WRITE AUTH');
  const minimalDay = { days: [{ dayNumber: 1, date: '2026-10-05', activities: [] }] };

  await step('FAILURE write with no credential', 401, 'PUT', `/api/trips/${tripId}/itinerary`, { body: minimalDay });
  await step('FAILURE write with wrong service key', 401, 'PUT', `/api/trips/${tripId}/itinerary`, {
    body: minimalDay,
    serviceKey: `${SERVICE_KEY}-wrong`,
  });
  await step("FAILURE non-owner token cannot write another user's itinerary", 404, 'PUT', `/api/trips/${tripId}/itinerary`, {
    body: minimalDay,
    token: outsiderToken,
  });
  await step('FAILURE malformed trip id is 400 not 500', 400, 'PUT', '/api/trips/not-a-uuid/itinerary', {
    body: minimalDay,
    serviceKey: SERVICE_KEY,
  });

  section('3. ML SERVICE WRITES A snake_case ITINERARY');
  const written = await step('service key writes 4 days in snake_case', 200, 'PUT', `/api/trips/${tripId}/itinerary`, {
    serviceKey: SERVICE_KEY,
    body: {
      model_version: MODEL_VERSION,
      days: [
        {
          day_number: 1,
          date: '2026-10-05',
          slot_type: 'outdoor_active',
          heat_tier: 'mild',
          weather_context: { highC: 18, lowC: 6, condition: 'clear' },
          hazard_context: { activeAlerts: 0, nearestHazardKm: null },
          activities: [
            { time: '08:00', title: 'Baltit Fort walk', slot_type: 'outdoor_active', heat_tier: 'mild' },
          ],
        },
        {
          day_number: 2,
          date: '2026-10-06',
          slot_type: 'indoor_rest',
          heat_tier: 'extreme',
          fallback_message: FALLBACK_MESSAGE,
          weather_context: { highC: 41, lowC: 27, condition: 'heatwave' },
          hazard_context: { activeAlerts: 1, category: 'weather' },
          activities: [{ time: '11:00', title: 'Rest and refuel', slot_type: 'indoor_rest' }],
        },
        {
          day_number: 3,
          date: '2026-10-07',
          slot_type: 'indoor_rest',
          heat_tier: 'hot',
          needs_marketplace_data: false,
          activities: [{ time: '10:00', title: 'Museum visit', slot_type: 'indoor_rest' }],
        },
        {
          day_number: 4,
          date: '2026-10-08',
          slot_type: 'travel',
          heat_tier: 'warm',
          activities: [{ time: '07:00', title: 'Return leg to Gilgit', slot_type: 'travel' }],
          heat_teir: 'typo-field',
        },
      ],
    },
  }, (b) => ({ source: b.source, writtenBy: b.writtenBy, days: b.days, modelVersion: b.modelVersion, ignoredFields: b.ignoredFields }));

  assert('write is attributed to the service', written.body.writtenBy === 'service',
    { writtenBy: written.body.writtenBy });
  assert('modelVersion round-trips', written.body.modelVersion === MODEL_VERSION,
    { modelVersion: written.body.modelVersion });
  assert('every stored day is tagged source=ml',
    written.body.itinerary.every((day) => day.source === 'ml'),
    written.body.itinerary.map((day) => day.source));

  section('4. snake_case IN, camelCase OUT');
  const day1 = dayByNumber(written.body, 1);
  assert('response uses camelCase keys only',
    day1.slotType === 'outdoor_active' && day1.heatTier === 'mild'
      && day1.slot_type === undefined && day1.heat_tier === undefined,
    day1);
  assert('per-activity slot fields are normalized too',
    day1.activities[0].slotType === 'outdoor_active'
      && day1.activities[0].heatTier === 'mild'
      && day1.activities[0].slot_type === undefined,
    day1.activities[0]);
  assert('weather and hazard context both persist',
    day1.weatherContext.condition === 'clear' && day1.hazardContext.activeAlerts === 0,
    { weatherContext: day1.weatherContext, hazardContext: day1.hazardContext });
  assert('unknown field surfaced in ignoredFields instead of silently dropped',
    Array.isArray(written.body.ignoredFields) && written.body.ignoredFields.includes('heat_teir'),
    { ignoredFields: written.body.ignoredFields });

  section('5. indoor_rest -> needsMarketplaceData -> marketplace hand-off');
  const day2 = dayByNumber(written.body, 2);
  assert('indoor_rest day defaults needsMarketplaceData to true without being told',
    day2.needsMarketplaceData === true,
    { slotType: day2.slotType, needsMarketplaceData: day2.needsMarketplaceData });
  assert('the ML fallback message is stored verbatim',
    day2.fallbackMessage === FALLBACK_MESSAGE,
    { fallbackMessage: day2.fallbackMessage });
  assert('flagged day carries a backend-owned marketplace object',
    day2.marketplace !== undefined && Array.isArray(day2.marketplace.guides),
    day2.marketplace ? { region: day2.marketplace.region, guideCount: day2.marketplace.guides.length } : undefined);
  assert('marketplace guides are REAL rows from the Guide table',
    day2.marketplace.guides.length > 0 && day2.marketplace.guides[0].id === listing.body.guide.id,
    day2.marketplace.guides.map((g) => ({ id: g.id, region: g.region, name: g.name })));
  assert('marketplace never leaks a guide phone number',
    day2.marketplace.guides.every((g) => g.phone === undefined),
    day2.marketplace.guides.map((g) => g.phone));
  assert('lodging and dining are empty arrays - no table backs them yet',
    Array.isArray(day2.marketplace.lodging) && day2.marketplace.lodging.length === 0
      && Array.isArray(day2.marketplace.dining) && day2.marketplace.dining.length === 0,
    { lodging: day2.marketplace.lodging, dining: day2.marketplace.dining });

  const day3 = dayByNumber(written.body, 3);
  assert('explicit needs_marketplace_data:false on an indoor_rest day is respected',
    day3.needsMarketplaceData === false && day3.marketplace === undefined,
    { needsMarketplaceData: day3.needsMarketplaceData, marketplace: day3.marketplace });

  const day4 = dayByNumber(written.body, 4);
  assert('non-indoor day gets no marketplace object', day4.marketplace === undefined,
    { slotType: day4.slotType, marketplace: day4.marketplace });

  section('6. READ BACK');
  const stored = await step('GET now returns the stored itinerary', 200, 'GET', `/api/trips/${tripId}/itinerary`,
    { token: travelerToken },
    (b) => ({ source: b.source, days: b.days, modelVersion: b.modelVersion }));
  assert('source flipped from placeholder to stored', stored.body.source === 'stored',
    { source: stored.body.source });
  assert('stored read reproduces the marketplace hand-off',
    dayByNumber(stored.body, 2).marketplace.guides.length > 0,
    { guideCount: dayByNumber(stored.body, 2).marketplace.guides.length });
  assert("owner's stored days survived with ids assigned",
    stored.body.itinerary.every((day) => typeof day.id === 'string' && day.id.length > 0),
    stored.body.itinerary.map((day) => day.id));
  await step("FAILURE non-owner cannot read the itinerary", 404, 'GET', `/api/trips/${tripId}/itinerary`,
    { token: outsiderToken });

  section('7. OWNER WRITE + REPLACE SEMANTICS');
  const ownerWrite = await step('trip owner overwrites with camelCase, 2 days', 200, 'PUT', `/api/trips/${tripId}/itinerary`, {
    token: travelerToken,
    body: {
      modelVersion: 'manual-edit-1',
      days: [
        {
          dayNumber: 1,
          date: '2026-10-05',
          slotType: 'outdoor_light',
          heatTier: 'warm',
          activities: [{ time: '09:00', title: 'Short valley loop', slotType: 'outdoor_light' }],
        },
        {
          dayNumber: 2,
          date: '2026-10-06',
          slotType: 'indoor_rest',
          heatTier: 'hot',
          activities: [],
        },
      ],
    },
  }, (b) => ({ writtenBy: b.writtenBy, days: b.days, sources: b.itinerary.map((d) => d.source) }));

  assert('owner write is attributed to the owner and tagged manual',
    ownerWrite.body.writtenBy === 'owner' && ownerWrite.body.itinerary.every((day) => day.source === 'manual'),
    { writtenBy: ownerWrite.body.writtenBy, sources: ownerWrite.body.itinerary.map((d) => d.source) });
  assert('PUT replaces rather than appends - 4 days became 2', ownerWrite.body.days === 2,
    { days: ownerWrite.body.days });

  const afterReplace = await call('GET', `/api/trips/${tripId}/itinerary`, { token: travelerToken });
  assert('replacement is durable on re-read', afterReplace.body.days === 2,
    { days: afterReplace.body.days, dayNumbers: afterReplace.body.itinerary.map((d) => d.dayNumber) });

  section('8. VALIDATION');
  const badCases = [
    ['FAILURE unknown slotType', { days: [{ dayNumber: 1, date: '2026-10-05', slotType: 'sunbathing', activities: [] }] }],
    ['FAILURE unknown heatTier', { days: [{ dayNumber: 1, date: '2026-10-05', heatTier: 'lukewarm', activities: [] }] }],
    ['FAILURE unknown slot_type on an activity', {
      days: [{ dayNumber: 1, date: '2026-10-05', activities: [{ title: 'x', slot_type: 'nope' }] }],
    }],
    ['FAILURE date outside the trip window', { days: [{ dayNumber: 1, date: '2027-01-01', activities: [] }] }],
    ['FAILURE duplicate dayNumber', {
      days: [
        { dayNumber: 1, date: '2026-10-05', activities: [] },
        { dayNumber: 1, date: '2026-10-06', activities: [] },
      ],
    }],
    ['FAILURE dayNumber zero', { days: [{ dayNumber: 0, date: '2026-10-05', activities: [] }] }],
    ['FAILURE non-calendar date', { days: [{ dayNumber: 1, date: '2026-02-31', activities: [] }] }],
    ['FAILURE activities missing', { days: [{ dayNumber: 1, date: '2026-10-05' }] }],
    ['FAILURE activities not an array', { days: [{ dayNumber: 1, date: '2026-10-05', activities: 'lots' }] }],
    ['FAILURE needsMarketplaceData not a boolean', {
      days: [{ dayNumber: 1, date: '2026-10-05', activities: [], needs_marketplace_data: 'yes' }],
    }],
    ['FAILURE days not an array', { days: 'four' }],
    ['FAILURE days empty', { days: [] }],
    ['FAILURE days missing entirely', {}],
  ];

  for (const [label, body] of badCases) {
    await step(label, 400, 'PUT', `/api/trips/${tripId}/itinerary`, { serviceKey: SERVICE_KEY, body },
      (b) => b.details || b.error);
  }

  await step('FAILURE write to an unknown trip', 404, 'PUT', '/api/trips/11111111-2222-3333-4444-555555555555/itinerary',
    { serviceKey: SERVICE_KEY, body: minimalDay });

  section('9. SERVICE KEY CROSSES OWNERSHIP, TOKENS DO NOT');
  await step('service key may write any trip, including one it does not own', 200, 'PUT',
    `/api/trips/${outsiderTrip.body.trip.id}/itinerary`, {
      serviceKey: SERVICE_KEY,
      body: { days: [{ dayNumber: 1, date: '2026-11-01', slotType: 'mixed', activities: [] }] },
    }, (b) => ({ writtenBy: b.writtenBy, days: b.days }));

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
