const crypto = require('crypto');
const { Op } = require('sequelize');
const { HazardAlert, sequelize } = require('../models');
const {
  isNonEmptyString,
  isFiniteNumber,
  isInRange,
  parsePagination,
} = require('../utils/validate');

const HAZARD_TYPES = ['weather', 'health', 'safety', 'political', 'natural_disaster', 'other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const ALLOWED_KEYS = [
  'sourceType',
  'source',
  'rawText',
  'hazardType',
  'region',
  'latitude',
  'longitude',
  'severity',
  'expiresAt',
  'description',
];
const MAX_TITLE_LENGTH = 120;
const MAX_RAW_TEXT_LENGTH = 10000;
const MAX_SOURCE_LENGTH = 255;

const SEVERITY_RANK = sequelize.literal(
  "CASE \"severity\" WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC",
);

function deriveTitle(rawText) {
  const collapsed = rawText.trim().replace(/\s+/g, ' ');
  if (collapsed.length <= MAX_TITLE_LENGTH) {
    return collapsed;
  }
  return `${collapsed.slice(0, MAX_TITLE_LENGTH - 3)}...`;
}

function dedupeHashFor(region, category, rawText) {
  const normalized = [region, category, rawText]
    .map((part) => String(part).trim().replace(/\s+/g, ' ').toLowerCase())
    .join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function publicHazard(alert) {
  const plain = typeof alert.get === 'function' ? alert.get({ plain: true }) : alert;

  return {
    id: plain.id,
    hazardType: plain.category,
    severity: plain.severity,
    region: plain.region,
    title: plain.title,
    description: plain.description,
    rawText: plain.rawText,
    source: plain.source,
    sourceType: plain.sourceType,
    latitude: plain.latitude,
    longitude: plain.longitude,
    isActive: plain.isActive,
    expiresAt: plain.expiresAt,
    createdAt: plain.createdAt,
  };
}

async function ingestHazard(req, res, next) {
  let dedupeHash = null;

  try {
    const body = req.body || {};
    const details = [];

    const unknownKeys = Object.keys(body).filter((key) => !ALLOWED_KEYS.includes(key));
    if (unknownKeys.length > 0) {
      details.push(`unexpected fields: ${unknownKeys.join(', ')}`);
    }

    if (!isNonEmptyString(body.sourceType)) {
      details.push('sourceType is required and must be a non-empty string');
    }
    if (!isNonEmptyString(body.rawText)) {
      details.push('rawText is required and must be a non-empty string');
    } else if (body.rawText.length > MAX_RAW_TEXT_LENGTH) {
      details.push(`rawText must be at most ${MAX_RAW_TEXT_LENGTH} characters`);
    }
    if (!HAZARD_TYPES.includes(body.hazardType)) {
      details.push(`hazardType is required and must be one of: ${HAZARD_TYPES.join(', ')}`);
    }
    if (!isNonEmptyString(body.region)) {
      details.push('region is required and must be a non-empty string');
    }
    if (!SEVERITIES.includes(body.severity)) {
      details.push(`severity is required and must be one of: ${SEVERITIES.join(', ')}`);
    }
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
      details.push('description must be a string');
    }
    if (body.source !== undefined && body.source !== null) {
      if (typeof body.source !== 'string') {
        details.push('source must be a string');
      } else if (body.source.trim().length > MAX_SOURCE_LENGTH) {
        details.push(`source must be at most ${MAX_SOURCE_LENGTH} characters`);
      }
    }

    const hasLatitude = body.latitude !== undefined && body.latitude !== null;
    const hasLongitude = body.longitude !== undefined && body.longitude !== null;

    if (hasLatitude && (!isFiniteNumber(body.latitude) || !isInRange(body.latitude, -90, 90))) {
      details.push('latitude must be a number between -90 and 90');
    }
    if (hasLongitude && (!isFiniteNumber(body.longitude) || !isInRange(body.longitude, -180, 180))) {
      details.push('longitude must be a number between -180 and 180');
    }
    if (hasLatitude !== hasLongitude) {
      details.push('latitude and longitude must be provided together');
    }

    let expiresAt = null;
    if (body.expiresAt !== undefined && body.expiresAt !== null) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        details.push('expiresAt must be a valid ISO 8601 timestamp');
      } else {
        expiresAt = parsed;
      }
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    dedupeHash = dedupeHashFor(body.region, body.hazardType, body.rawText);

    const existing = await HazardAlert.findOne({ where: { dedupeHash } });
    if (existing) {
      return res.status(200).json({ alert: publicHazard(existing), duplicate: true });
    }

    const alert = await HazardAlert.create({
      region: body.region.trim(),
      category: body.hazardType,
      severity: body.severity,
      title: deriveTitle(body.rawText),
      description: isNonEmptyString(body.description) ? body.description.trim() : null,
      rawText: body.rawText.trim(),
      source: isNonEmptyString(body.source) ? body.source.trim() : null,
      sourceType: body.sourceType.trim(),
      latitude: hasLatitude ? Number(body.latitude) : null,
      longitude: hasLongitude ? Number(body.longitude) : null,
      isActive: true,
      expiresAt,
      dedupeHash,
    });

    return res.status(201).json({ alert: publicHazard(alert), duplicate: false });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError' && dedupeHash) {
      const raced = await HazardAlert.findOne({ where: { dedupeHash } });
      if (raced) {
        return res.status(200).json({ alert: publicHazard(raced), duplicate: true });
      }
    }
    return next(err);
  }
}

async function listHazards(req, res, next) {
  try {
    const page = parsePagination(req, res);
    if (!page) {
      return undefined;
    }

    const { region } = req.query;
    const where = {
      isActive: true,
      [Op.or]: [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } },
      ],
    };

    if (isNonEmptyString(region)) {
      where.region = { [Op.iLike]: `%${region.trim()}%` };
    }

    const { rows, count: total } = await HazardAlert.findAndCountAll({
      where,
      order: [SEVERITY_RANK, ['createdAt', 'DESC']],
      limit: page.limit,
      offset: page.offset,
    });

    return res.status(200).json({
      count: rows.length,
      total,
      limit: page.limit,
      offset: page.offset,
      region: isNonEmptyString(region) ? region.trim() : null,
      alerts: rows.map((alert) => publicHazard(alert)),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { ingestHazard, listHazards, publicHazard };
