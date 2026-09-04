const { UserDestinationState, sequelize } = require('../models');
const { getUserExcludeList } = require('../services/getUserExcludeList');
const {
  DESTINATION_STATE_STATUSES,
  MAX_DESTINATION_NAME_LENGTH,
  normalizeDestinationName,
  destinationKey,
} = require('../utils/destinationState');
const { isNonEmptyString, unknownKeys } = require('../utils/validate');

const ALLOWED_KEYS = ['destinationName', 'status'];

function publicState(row) {
  const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;

  return {
    destinationName: plain.destinationName,
    status: plain.status,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function findByKey(userId, key, transaction) {
  return UserDestinationState.findOne({
    where: sequelize.and(
      { userId },
      sequelize.where(sequelize.fn('lower', sequelize.col('destination_name')), key),
    ),
    transaction,
  });
}

async function setDestinationState(req, res, next) {
  try {
    const body = req.body || {};
    const details = [];

    const unexpected = unknownKeys(body, ALLOWED_KEYS);
    if (unexpected.length > 0) {
      details.push(`unexpected fields: ${unexpected.join(', ')}`);
      details.push(`accepted fields are: ${ALLOWED_KEYS.join(', ')}`);
    }

    if (!isNonEmptyString(body.destinationName)) {
      details.push('destinationName is required and must be a non-empty string');
    } else if (normalizeDestinationName(body.destinationName).length > MAX_DESTINATION_NAME_LENGTH) {
      details.push(`destinationName must be at most ${MAX_DESTINATION_NAME_LENGTH} characters`);
    }

    if (!DESTINATION_STATE_STATUSES.includes(body.status)) {
      details.push(`status must be one of: ${DESTINATION_STATE_STATUSES.join(', ')}`);
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const destinationName = normalizeDestinationName(body.destinationName);
    const key = destinationKey(destinationName);

    const result = await sequelize.transaction(async (transaction) => {
      const existing = await findByKey(req.user.id, key, transaction);

      if (existing) {
        existing.destinationName = destinationName;
        existing.status = body.status;
        await existing.save({ transaction });
        return { row: existing, created: false };
      }

      const inserted = await UserDestinationState.create(
        { userId: req.user.id, destinationName, status: body.status },
        { transaction },
      );
      return { row: inserted, created: true };
    });

    return res.status(result.created ? 201 : 200).json({
      destinationState: publicState(result.row),
      created: result.created,
    });
  } catch (err) {
    return next(err);
  }
}

async function listDestinationState(req, res, next) {
  try {
    const rows = await UserDestinationState.findAll({
      where: { userId: req.user.id },
      order: [['destinationName', 'ASC']],
    });

    return res.status(200).json({
      userId: req.user.id,
      count: rows.length,
      excludeList: await getUserExcludeList(req.user.id),
      destinationState: rows.map(publicState),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { setDestinationState, listDestinationState, publicState };
