const mlClient = require('./mlClient');

// JS mirror of ml-pipeline/scripts/hazard_keywords.py HAZARD_KEYWORDS
const HAZARD_KEYWORDS = [
  'landslide', 'landslip', 'rockfall', 'mudslide', 'avalanche',
  'flood', 'flooding', 'flash flood', 'glacier burst', 'glof',
  'earthquake', 'road blocked', 'road closure', 'roadblock',
  'bridge collapsed', 'bridge damaged', 'pass closed',
  'storm', 'blizzard', 'heavy snowfall', 'heavy rain',
  'landslide warning', 'debris flow',
];

function keywordHeuristic(text) {
  const lower = String(text || '').toLowerCase();
  const matches = HAZARD_KEYWORDS.filter((kw) => lower.includes(kw));
  const confidence = matches.length > 0
    ? Math.min(0.5 + matches.length * 0.12, 0.95)
    : 0.1;
  return {
    text: String(text || ''),
    hazardConfidence: Number(confidence.toFixed(2)),
    isHazard: matches.length > 0,
  };
}

async function classifyHazardText(text) {
  if (!mlClient.isConfigured()) {
    return {
      source: 'mock',
      mocked: true,
      degraded: false,
      reason: 'ml_service_not_configured',
      verdict: keywordHeuristic(text),
    };
  }

  const result = await mlClient.predictHazard([text]);

  if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
    const row = result.data[0];
    return {
      source: 'ml',
      mocked: false,
      degraded: false,
      reason: null,
      verdict: {
        text: String(text || ''),
        hazardConfidence: typeof row.hazard_confidence === 'number' ? row.hazard_confidence : 0,
        isHazard: Boolean(row.is_hazard),
      },
    };
  }

  return {
    source: 'mock',
    mocked: true,
    degraded: true,
    reason: result.reason || 'upstream_error',
    verdict: keywordHeuristic(text),
  };
}

module.exports = { classifyHazardText, keywordHeuristic, HAZARD_KEYWORDS };
