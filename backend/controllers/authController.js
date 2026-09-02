const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken } = require('../utils/jwt');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const SIGNUP_ROLES = ['traveler', 'guide'];
const DECOY_HASH = bcrypt.hashSync('routelink-decoy-value', BCRYPT_ROUNDS);

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    preferences: user.preferences,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function signup(req, res, next) {
  try {
    const { name, email, password, role } = req.body || {};
    const details = [];

    if (!isNonEmptyString(name)) {
      details.push('name is required');
    }
    if (!isNonEmptyString(email)) {
      details.push('email is required');
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      details.push('email must be a valid email address');
    }
    if (typeof password !== 'string' || password.length === 0) {
      details.push('password is required');
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      details.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (role !== undefined && !SIGNUP_ROLES.includes(role)) {
      details.push(`role must be one of: ${SIGNUP_ROLES.join(', ')}`);
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: role || 'traveler',
    });

    const token = signToken({ id: user.id, role: user.role });
    return res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const details = [];

    if (!isNonEmptyString(email)) {
      details.push('email is required');
    }
    if (typeof password !== 'string' || password.length === 0) {
      details.push('password is required');
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details });
    }

    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    const passwordMatches = await bcrypt.compare(password, user ? user.password : DECOY_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const token = signToken({ id: user.id, role: user.role });
    return res.status(200).json({ user: publicUser(user), token });
  } catch (err) {
    return next(err);
  }
}

module.exports = { signup, login, publicUser };
