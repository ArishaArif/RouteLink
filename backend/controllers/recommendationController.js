const { getRecommendations, getPreferenceRecommendations, MIN_POOL_SIZE, MAX_POOL_SIZE } = require('../services/recommendationService');
const { getUserExcludeList } = require('../services/getUserExcludeList');
const { normalizeDestinationName, MAX_DESTINATION_NAME_LENGTH } = require('../utils/destinationState');
const { isNonEmptyString } = require('../utils/validate');
const mlClient = require('../services/mlClient');

const INTEGER_PATTERN = /^\d+$/;
const MAX_CATEGORIES = 10;
const MAX_CATEGORY_LENGTH = 64;
const MAX_PROVINCE_LENGTH = 255;

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

module.exports = { listRecommendations, listPreferenceRecommendations, getDestinationPhoto };

async function getDestinationPhoto(req, res, next) {
  try {
    const { name } = req.query;
    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: 'Validation failed', details: ['name is required'] });
    }

    const result = await mlClient.fetchPhotoUrl(name.trim());

    if (result.ok && result.data && result.data.photoUrl) {
      // photoUrl is a relative path like "destination_images/baltit_fort.jpg"
      // Resolve it to a full URL the frontend can load from the ML service.
      const fullUrl = `${mlClient.baseUrl()}/images/${result.data.photoUrl.replace(/^destination_images\//, '')}`;
      return res.status(200).json({
        name: result.data.name || name,
        photoUrl: fullUrl,
        source: result.data.source || 'ml',
        mlAvailable: true,
      });
    }

    return res.status(200).json({
      name,
      photoUrl: null,
      source: null,
      mlAvailable: false,
    });
  } catch (err) {
    return next(err);
  }
}

async function listPreferenceRecommendations(req, res, next) {
  try {
    const details = [];
    const { categories, province, limit } = req.body || {};

    if (!Array.isArray(categories) || categories.length === 0) {
      details.push('categories is required and must be a non-empty array');
    } else {
      if (categories.length > MAX_CATEGORIES) {
        details.push(`categories must have at most ${MAX_CATEGORIES} items`);
      }
      for (let i = 0; i < categories.length; i++) {
        if (typeof categories[i] !== 'string' || categories[i].trim().length === 0) {
          details.push(`categories[${i}] must be a non-empty string`);
        } else if (categories[i].trim().length > MAX_CATEGORY_LENGTH) {
          details.push(`categories[${i}] must be at most ${MAX_CATEGORY_LENGTH} characters`);
        }
      }
    }

    if (province !== undefined && province !== null) {
      if (typeof province !== 'string') {
        details.push('province must be a string');
      } else if (province.trim().length > MAX_PROVINCE_LENGTH) {
        details.push(`province must be at most ${MAX_PROVINCE_LENGTH} characters`);
      }
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
    const result = await getPreferenceRecommendations(
      categories.map((c) => c.trim().toLowerCase()),
      { province: province ? province.trim() : undefined, exclude: excludeList, poolSize: limit },
    );

    return res.status(200).json({
      categories: result.categories,
      province: result.province,
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
