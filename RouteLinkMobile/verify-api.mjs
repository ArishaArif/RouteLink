const BASE = 'http://localhost:5000';
const stamp = Date.now();
const results = [];
let token = null;

const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

async function call(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

const email = `verify${stamp}@routelink.app`;
const password = 'verify-pass-8';

const signup = await call('POST', '/api/auth/signup', { name: 'Verify Bot', email, password });
check('signup 201 + token + user.id', signup.status === 201 && isStr(signup.data?.token) && isStr(signup.data?.user?.id), `status=${signup.status}`);
token = signup.data?.token;
const userId = signup.data?.user?.id;

const login = await call('POST', '/api/auth/login', { email, password });
check('login returns token', login.status === 200 && isStr(login.data?.token), `status=${login.status}`);

const shortPw = await call('POST', '/api/auth/signup', { name: 'X', email: `x${stamp}@r.app`, password: '1234567' });
check('signup <8 chars rejected 400 (AuthScreen rule)', shortPw.status === 400, `status=${shortPw.status}`);
check('400 carries details[] for AuthScreen', Array.isArray(shortPw.data?.details), `details=${JSON.stringify(shortPw.data?.details)?.slice(0, 90)}`);

const trips0 = await call('GET', '/api/trips');
check('GET /api/trips -> data.trips array', trips0.status === 200 && Array.isArray(trips0.data?.trips), `status=${trips0.status}`);
check('new user starts with 0 trips (no auto-create)', (trips0.data?.trips || []).length === 0, `count=${(trips0.data?.trips || []).length}`);

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const startDate = iso(new Date(today.getTime() + 86400000 * 7));
const endDate = iso(new Date(today.getTime() + 86400000 * 11));

const created = await call('POST', '/api/trips', { title: 'Verify Trip', destination: 'Hunza Valley', startDate, endDate, budget: 50000 });
check('POST /api/trips -> data.trip', created.status === 201 && isStr(created.data?.trip?.id), `status=${created.status}`);
const tripId = created.data?.trip?.id;
check('budget is a JSON number, not a string', isNum(created.data?.trip?.budget), `budget=${JSON.stringify(created.data?.trip?.budget)}`);

const trips1 = await call('GET', '/api/trips');
check('trip count is 1 after exactly one create', (trips1.data?.trips || []).length === 1, `count=${(trips1.data?.trips || []).length}`);

const gotTrip = await call('GET', `/api/trips/${tripId}`);
check('GET /api/trips/:id -> data.trip', gotTrip.status === 200 && gotTrip.data?.trip?.id === tripId);

const patched = await call('PATCH', `/api/trips/${tripId}`, { title: 'Verify Trip Renamed' });
check('PATCH /api/trips/:id -> data.trip updated', patched.status === 200 && patched.data?.trip?.title === 'Verify Trip Renamed');

const itin = await call('GET', `/api/trips/${tripId}/itinerary`);
const days = itin.data?.itinerary;
check('GET itinerary -> itinerary[] at top level', itin.status === 200 && Array.isArray(days), `status=${itin.status} keys=${Object.keys(itin.data || {}).join(',')}`);
check('TripItinerary.source present', isStr(itin.data?.source), `source=${itin.data?.source}`);
const d0 = days?.[0];
check('TripDay has dayNumber + date', isNum(d0?.dayNumber) && isStr(d0?.date), `day0=${JSON.stringify(d0)?.slice(0, 110)}`);
check('heatTier key always present (§6)', d0 ? 'heatTier' in d0 : false, `heatTier=${JSON.stringify(d0?.heatTier)}`);
check('needsMarketplaceData key always present', d0 ? 'needsMarketplaceData' in d0 : false);
check('activities is an array', Array.isArray(d0?.activities), `n=${d0?.activities?.length}`);

const guides = await call('GET', '/api/guides');
check('GET /api/guides -> data.guides array', guides.status === 200 && Array.isArray(guides.data?.guides), `status=${guides.status}`);
const guide = guides.data?.guides?.[0];
check('guides exist to book', !!guide, `count=${guides.data?.guides?.length}`);
if (guide) {
  check('guide.pricePerDay is a number', isNum(guide.pricePerDay), `pricePerDay=${JSON.stringify(guide.pricePerDay)}`);
  check('guide.rating is a number', isNum(guide.rating), `rating=${JSON.stringify(guide.rating)}`);
  check('guide.languages is array or absent', guide.languages === undefined || Array.isArray(guide.languages), `languages=${JSON.stringify(guide.languages)}`);
  check('guide.phone hidden for non-owner', guide.phone === undefined || guide.phone === null, `phone=${JSON.stringify(guide.phone)}`);

  const one = await call('GET', `/api/guides/${guide.id}`);
  check('GET /api/guides/:id -> data.guide', one.status === 200 && one.data?.guide?.id === guide.id);

  const langGuides = await call('GET', '/api/guides?language=Urdu');
  check('GET /api/guides?language= accepted', langGuides.status === 200 && Array.isArray(langGuides.data?.guides), `status=${langGuides.status} count=${langGuides.data?.guides?.length}`);

  const regionGuides = await call('GET', '/api/guides?region=Hunza');
  check('GET /api/guides?region= accepted', regionGuides.status === 200 && Array.isArray(regionGuides.data?.guides), `count=${regionGuides.data?.guides?.length}`);
}

const hazards = await call('GET', '/api/hazards');
check('GET /api/hazards -> data.alerts array', hazards.status === 200 && Array.isArray(hazards.data?.alerts), `status=${hazards.status} count=${hazards.data?.alerts?.length}`);
const alert = hazards.data?.alerts?.[0];
if (alert) {
  check('alert has severity + region + hazardType', isStr(alert.severity) && 'region' in alert && isStr(alert.hazardType), `severity=${alert.severity} type=${alert.hazardType}`);
  check('alert.createdAt present for relative time', isStr(alert.createdAt), `createdAt=${alert.createdAt}`);
  check('alert lat/lng numeric-or-null', (alert.latitude === null || isNum(alert.latitude) || typeof alert.latitude === 'string'), `lat=${JSON.stringify(alert.latitude)}`);
}

const recs = await call('GET', '/api/recommendations?destination=Hunza%20Valley&limit=8');
check('GET /api/recommendations 200', recs.status === 200, `status=${recs.status}`);
check('-> data.recommendations array', Array.isArray(recs.data?.recommendations), `count=${recs.data?.recommendations?.length}`);
check('response carries source/mocked/degraded', 'source' in (recs.data || {}) && 'degraded' in (recs.data || {}), `source=${recs.data?.source} degraded=${recs.data?.degraded} reason=${recs.data?.reason}`);
const spot = recs.data?.recommendations?.[0];
if (spot) {
  check('spot has id + name (AttractionCard keys)', isStr(spot.id) && isStr(spot.name), `id=${spot.id?.slice(0, 12)} name=${spot.name}`);
  check('spot.latitude nullable as §19 warns', spot.latitude === null || isNum(spot.latitude), `lat=${JSON.stringify(spot.latitude)}`);
  check('spot.imageUrl null as §19 states', spot.imageUrl === null || spot.imageUrl === undefined, `imageUrl=${JSON.stringify(spot.imageUrl)}`);
}

const dsEmpty = await call('GET', '/api/users/me/destination-state');
check('GET destination-state 200', dsEmpty.status === 200, `status=${dsEmpty.status} keys=${Object.keys(dsEmpty.data || {}).join(',')}`);

const marked = await call('POST', '/api/users/me/destination-state', { destinationName: 'Passu Cones', status: 'dismissed' });
check('POST destination-state accepted', marked.status === 200 || marked.status === 201, `status=${marked.status}`);

const dsAfter = await call('GET', '/api/users/me/destination-state');
const excl = dsAfter.data?.excludeList || dsAfter.data?.exclude || [];
check('dismissed name appears in excludeList', Array.isArray(excl) && excl.some((n) => String(n).toLowerCase() === 'passu cones'), `excludeList=${JSON.stringify(excl)}`);

if (guide && tripId) {
  const booking = await call('POST', '/api/bookings', { tripId, guideId: guide.id, startDate, endDate });
  check('POST /api/bookings -> data.booking', booking.status === 201 && isStr(booking.data?.booking?.id), `status=${booking.status} msg=${booking.data?.message || booking.data?.error || ''}`);
  const bookingId = booking.data?.booking?.id;
  check('booking.totalPrice is a number', isNum(booking.data?.booking?.totalPrice), `totalPrice=${JSON.stringify(booking.data?.booking?.totalPrice)}`);
  check(
    'booking carries the fields the success sheet renders',
    isNum(booking.data?.booking?.totalPrice) && isStr(booking.data?.booking?.startDate) && isStr(booking.data?.booking?.endDate),
    `range=${booking.data?.booking?.startDate}..${booking.data?.booking?.endDate}`
  );

  const dup = await call('POST', '/api/bookings', { tripId, guideId: guide.id, startDate, endDate });
  check('overlapping booking -> 409', dup.status === 409, `status=${dup.status}`);
  check('409 body carries conflict range for GuideDetail', !!dup.data?.conflict, `conflict=${JSON.stringify(dup.data?.conflict)}`);

  const outOfRange = await call('POST', '/api/bookings', { tripId, guideId: guide.id, startDate: '2020-01-01', endDate: '2020-01-05' });
  check('dates outside trip range -> 400', outOfRange.status === 400, `status=${outOfRange.status}`);

  const list = await call('GET', '/api/bookings');
  check('GET /api/bookings -> data.bookings array', list.status === 200 && Array.isArray(list.data?.bookings), `count=${list.data?.bookings?.length}`);
  const row = (list.data?.bookings || [])[0];
  if (row) {
    check('booking row has viewerRole', isStr(row.viewerRole), `viewerRole=${row.viewerRole}`);
    check('booking row nests trip + guide', !!row.trip || !!row.guide, `hasTrip=${!!row.trip} hasGuide=${!!row.guide}`);
    check('booking.status in vocabulary', ['requested', 'confirmed', 'cancelled', 'completed'].includes(row.status), `status=${row.status}`);
  }

  if (bookingId) {
    const msg = await call('POST', `/api/bookings/${bookingId}/messages`, { text: 'Verify hello' });
    check('POST message -> data.message', (msg.status === 200 || msg.status === 201) && isStr(msg.data?.message?.id), `status=${msg.status}`);
    check('message.senderId is caller (from JWT)', msg.data?.message?.senderId === userId, `senderId=${msg.data?.message?.senderId}`);

    const msgs = await call('GET', `/api/bookings/${bookingId}/messages`);
    check('GET messages -> data.messages array', msgs.status === 200 && Array.isArray(msgs.data?.messages), `count=${msgs.data?.messages?.length}`);
    check('sent message reads back', (msgs.data?.messages || []).some((m) => m.text === 'Verify hello'));

    const patchStatus = await call('PATCH', `/api/bookings/${bookingId}/status`, { status: 'confirmed' });
    check('traveler PATCH status -> 403 (read-only in UI)', patchStatus.status === 403, `status=${patchStatus.status}`);
  }
}

const nearest = await call('GET', '/api/sos/nearest?latitude=36.3167&longitude=74.65');
check('GET /api/sos/nearest -> data.nearest', nearest.status === 200 && !!nearest.data?.nearest, `status=${nearest.status}`);
check('nearest.mocked present (SOS renders it)', typeof nearest.data?.nearest?.mocked === 'boolean', `mocked=${nearest.data?.nearest?.mocked}`);
check('nearest.services array', Array.isArray(nearest.data?.nearest?.services), `count=${nearest.data?.nearest?.services?.length}`);
check('nearest.emergencyNumbers array', Array.isArray(nearest.data?.nearest?.emergencyNumbers), `count=${nearest.data?.nearest?.emergencyNumbers?.length}`);
const svc = nearest.data?.nearest?.services?.[0];
if (svc) check('service.distanceKm numeric-or-string (parseNumber handles)', isNum(svc.distanceKm) || isStr(svc.distanceKm), `distanceKm=${JSON.stringify(svc.distanceKm)}`);

const sos = await call('POST', '/api/sos', { latitude: 36.3167, longitude: 74.65 });
check('POST /api/sos 200', sos.status === 200 || sos.status === 201, `status=${sos.status}`);
check('sos.persisted === false (SOS shows the warning)', sos.data?.sos?.persisted === false, `persisted=${JSON.stringify(sos.data?.sos?.persisted)}`);
check('sos.nearest nested as api.ts expects', !!sos.data?.nearest?.services, `keys=${Object.keys(sos.data || {}).join(',')}`);

const noAuth = await fetch(`${BASE}/api/trips`);
check('unauthenticated /api/trips -> 401', noAuth.status === 401, `status=${noAuth.status}`);

const del = await call('DELETE', `/api/trips/${tripId}`);
check('DELETE /api/trips/:id (TripsScreen)', del.status === 200 || del.status === 204, `status=${del.status}`);

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log('\nFAILURES:');
  failed.forEach((f) => console.log(`  - ${f.name}  ${f.detail}`));
}
