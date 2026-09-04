const crypto = require('crypto');

const NAMESPACE = 'routelink.destination';

function destinationId(name) {
  const hash = crypto.createHash('sha1').update(`${NAMESPACE}:${String(name).toLowerCase()}`).digest('hex');
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

function describeDestination(name, category, province) {
  const parts = [];
  if (category) {
    parts.push(String(category));
  }
  if (province) {
    parts.push(`in ${province}`);
  }
  if (parts.length === 0) {
    return `${name}, Pakistan`;
  }
  const sentence = `${name} is a ${parts.join(' ')}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

module.exports = { destinationId, describeDestination, NAMESPACE };
