const { getRecommendations, MIN_POOL_SIZE, MAX_POOL_SIZE } = require('../services/recommendationService');
const { getUserExcludeList } = require('../services/getUserExcludeList');
const { normalizeDestinationName, MAX_DESTINATION_NAME_LENGTH } = require('../utils/destinationState');
const { isNonEmptyString } = require('../utils/validate');

const INTEGER_PATTERN = /^\d+$/;

async function listRecommendations(req, res, next) {
  try {
    const details = [];
    const { destination, limit } = req.query;

    if (!isNonEmptyString(destination)) {
      details.push('destination is required and must be a non-empty string');
    } else if (normalizeDestinationName(destination).length > MAX_DESTINATION_NAME_LENGTH) {
      details.push(`destination must be at most ${MAX_DESTINATION_NAME_LENGTH} characters`);
    }

    if (limit !== undefined) {
      if (!INTEGER_PATTERN.test(String(limit))) {
        details.push('limit must be a positive integer');
      } else if (Number(limit) < MIN_POOL_SIZE || Number(limit) > MAX_POOL_SIZE) {
        details.push(`limit must be between ${MIN_POOL_SIZE} and ${MAX_POOL_SIZE}`);
      }
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const excludeList = await getUserExcludeList(req.user.id);
    const result = await getRecommendations(destination, { exclude: excludeList, poolSize: limit });

    return res.status(200).json({
      destination: result.destination,
      count: result.recommendations.length,
      source: result.source,
      mocked: result.mocked,
      degraded: result.degraded,
      reason: result.reason,
      excludeApplied: result.excludeApplied,
      recommendations: result.recommendations,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listRecommendations };
