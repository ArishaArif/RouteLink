const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_BASE_URL = 'http://localhost:8000';

function baseUrl() {
  const configured = process.env.ML_SERVICE_URL;
  const value = typeof configured === 'string' && configured.trim().length > 0 ? configured.trim() : '';
  return value.replace(/\/+$/, '');
}

function isConfigured() {
  return baseUrl().length > 0;
}

function timeoutMs() {
  const parsed = Number.parseInt(process.env.ML_SERVICE_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function request(method, path, { query, body } = {}) {
  if (!isConfigured()) {
    return { ok: false, reason: 'not_configured', status: null, data: null };
  }

  const search = query && query.toString().length > 0 ? `?${query.toString()}` : '';
  const url = `${baseUrl()}${path}${search}`;
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs()),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' || err.name === 'AbortError' ? 'timeout' : 'unreachable';
    return { ok: false, reason, status: null, data: null, message: err.message };
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (response.status === 404) {
    return { ok: false, reason: 'not_in_catalog', status: 404, data };
  }

  if (!response.ok) {
    return { ok: false, reason: 'upstream_error', status: response.status, data };
  }

  return { ok: true, reason: null, status: response.status, data };
}

function recommendationQuery(topN, exclude) {
  const params = new URLSearchParams();
  params.set('top_n', String(topN));
  exclude.forEach((name) => params.append('exclude', name));
  return params;
}

async function fetchSimilarDestinations(destination, { topN, exclude = [] } = {}) {
  return request('POST', `/api/recommend/similar/${encodeURIComponent(destination)}`, {
    query: recommendationQuery(topN, exclude),
  });
}

async function health() {
  return request('GET', '/health');
}

module.exports = {
  isConfigured,
  baseUrl,
  timeoutMs,
  fetchSimilarDestinations,
  health,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
};
