const { Op } = require('sequelize');
const { Guide, User, sequelize } = require('../models');
const {
  isNonEmptyString,
  isFiniteNumber,
  requireUuidParam,
  parsePagination,
  unknownKeys,
} = require('../utils/validate');

const UPDATABLE_FIELDS = ['region', 'languages', 'bio', 'phone', 'pricePerDay', 'isAvailable'];
const MAX_PHONE_LENGTH = 32;

const USER_INCLUDE = [{ model: User, as: 'user', attributes: ['id', 'name', 'role'] }];

function publicGuide(guide, includePhone = false) {
  const plain = typeof guide.get === 'function' ? guide.get({ plain: true }) : guide;
  const user = plain.user
    ? { id: plain.user.id, name: plain.user.name, role: plain.user.role }
    : undefined;

  const result = {
    id: plain.id,
    userId: plain.userId,
    name: plain.user ? plain.user.name : undefined,
    region: plain.region,
    languages: plain.languages,
    bio: plain.bio,
    pricePerDay: plain.pricePerDay,
    rating: plain.rating,
    isAvailable: plain.isAvailable,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    user,
  };

  if (includePhone) {
    result.phone = plain.phone;
  }

  return result;
}

function canSeePhone(guide, user) {
  if (!user) {
    return false;
  }
  return guide.userId === user.id || user.role === 'admin';
}

function validateLanguages(value, details) {
  if (!Array.isArray(value)) {
    details.push('languages must be an array of strings');
    return;
  }
  if (value.length === 0) {
    details.push('languages must contain at least one language');
    return;
  }
  if (!value.every(isNonEmptyString)) {
    details.push('languages must contain only non-empty strings');
  }
}

async function listGuides(req, res, next) {
  try {
    const page = parsePagination(req, res);
    if (!page) {
      return undefined;
    }

    const { region, language } = req.query;
    const where = {};
    const conditions = [];

    if (isNonEmptyString(region)) {
      where.region = { [Op.iLike]: `%${region.trim()}%` };
    }
    if (isNonEmptyString(language)) {
      conditions.push(sequelize.literal(
        `EXISTS (SELECT 1 FROM unnest("Guide"."languages") AS lang WHERE lower(lang) = lower(${sequelize.escape(language.trim())}))`,
      ));
    }
    if (conditions.length > 0) {
      where[Op.and] = conditions;
    }

    const { rows, count: total } = await Guide.findAndCountAll({
      where,
      include: USER_INCLUDE,
      order: [['rating', 'DESC'], ['createdAt', 'ASC']],
      limit: page.limit,
      offset: page.offset,
    });

    return res.status(200).json({
      count: rows.length,
      total,
      limit: page.limit,
      offset: page.offset,
      filters: {
        region: isNonEmptyString(region) ? region.trim() : null,
        language: isNonEmptyString(language) ? language.trim() : null,
      },
      guides: rows.map((guide) => publicGuide(guide, canSeePhone(guide, req.user))),
    });
  } catch (err) {
    return next(err);
  }
}

async function getGuide(req, res, next) {
  try {
    const guideId = requireUuidParam(req, res, 'id', 'Guide id');
    if (!guideId) {
      return undefined;
    }

    const guide = await Guide.findByPk(guideId, { include: USER_INCLUDE });
    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    return res.status(200).json({ guide: publicGuide(guide, canSeePhone(guide, req.user)) });
  } catch (err) {
    return next(err);
  }
}

async function createGuide(req, res, next) {
  try {
    const { region, languages, bio, phone, pricePerDay, isAvailable } = req.body || {};
    const details = [];

    if (!isNonEmptyString(region)) {
      details.push('region is required');
    }
    validateLanguages(languages, details);
    if (pricePerDay === undefined || !isFiniteNumber(pricePerDay)) {
      details.push('pricePerDay is required and must be a number');
    } else if (Number(pricePerDay) < 0) {
      details.push('pricePerDay must not be negative');
    }
    if (bio !== undefined && bio !== null && typeof bio !== 'string') {
      details.push('bio must be a string');
    }
    if (phone !== undefined && phone !== null) {
      if (typeof phone !== 'string') {
        details.push('phone must be a string');
      } else if (phone.trim().length > MAX_PHONE_LENGTH) {
        details.push(`phone must be at most ${MAX_PHONE_LENGTH} characters`);
      }
    }
    if (isAvailable !== undefined && typeof isAvailable !== 'boolean') {
      details.push('isAvailable must be a boolean');
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const existing = await Guide.findOne({ where: { userId: req.user.id } });
    if (existing) {
      return res.status(409).json({
        error: 'This account already has a guide listing',
        guideId: existing.id,
      });
    }

    const guide = await Guide.create({
      userId: req.user.id,
      region: region.trim(),
      languages: languages.map((lang) => lang.trim()),
      bio: isNonEmptyString(bio) ? bio.trim() : null,
      phone: isNonEmptyString(phone) ? phone.trim() : null,
      pricePerDay: Number(pricePerDay),
      isAvailable: isAvailable === undefined ? true : isAvailable,
    });

    const created = await Guide.findByPk(guide.id, { include: USER_INCLUDE });

    return res.status(201).json({ guide: publicGuide(created, true) });
  } catch (err) {
    return next(err);
  }
}

async function updateGuide(req, res, next) {
  try {
    const guideId = requireUuidParam(req, res, 'id', 'Guide id');
    if (!guideId) {
      return undefined;
    }

    const guide = await Guide.findByPk(guideId);
    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }
    if (guide.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own guide listing' });
    }

    const body = req.body || {};
    const unexpected = unknownKeys(body, UPDATABLE_FIELDS);
    if (unexpected.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [
          `unexpected fields: ${unexpected.join(', ')}`,
          `updatable fields are: ${UPDATABLE_FIELDS.join(', ')}`,
        ],
      });
    }

    const provided = UPDATABLE_FIELDS.filter((field) => body[field] !== undefined);
    if (provided.length === 0) {
      return res.status(400).json({
        error: 'No updatable fields provided',
        details: [`provide at least one of: ${UPDATABLE_FIELDS.join(', ')}`],
      });
    }

    const details = [];
    if (body.region !== undefined && !isNonEmptyString(body.region)) {
      details.push('region must be a non-empty string');
    }
    if (body.languages !== undefined) {
      validateLanguages(body.languages, details);
    }
    if (body.bio !== undefined && body.bio !== null && typeof body.bio !== 'string') {
      details.push('bio must be a string');
    }
    if (body.phone !== undefined && body.phone !== null) {
      if (typeof body.phone !== 'string') {
        details.push('phone must be a string');
      } else if (body.phone.trim().length > MAX_PHONE_LENGTH) {
        details.push(`phone must be at most ${MAX_PHONE_LENGTH} characters`);
      }
    }
    if (body.pricePerDay !== undefined) {
      if (!isFiniteNumber(body.pricePerDay)) {
        details.push('pricePerDay must be a number');
      } else if (Number(body.pricePerDay) < 0) {
        details.push('pricePerDay must not be negative');
      }
    }
    if (body.isAvailable !== undefined && typeof body.isAvailable !== 'boolean') {
      details.push('isAvailable must be a boolean');
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const updates = {};
    if (body.region !== undefined) {
      updates.region = body.region.trim();
    }
    if (body.languages !== undefined) {
      updates.languages = body.languages.map((lang) => lang.trim());
    }
    if (body.bio !== undefined) {
      updates.bio = isNonEmptyString(body.bio) ? body.bio.trim() : null;
    }
    if (body.phone !== undefined) {
      updates.phone = isNonEmptyString(body.phone) ? body.phone.trim() : null;
    }
    if (body.pricePerDay !== undefined) {
      updates.pricePerDay = Number(body.pricePerDay);
    }
    if (body.isAvailable !== undefined) {
      updates.isAvailable = body.isAvailable;
    }

    await guide.update(updates);

    const updated = await Guide.findByPk(guide.id, { include: USER_INCLUDE });

    return res.status(200).json({ guide: publicGuide(updated, true), updated: provided });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listGuides, getGuide, createGuide, updateGuide, publicGuide };
