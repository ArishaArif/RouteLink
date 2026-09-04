const DESTINATION_STATE_STATUSES = ['visited', 'dismissed'];
const MAX_DESTINATION_NAME_LENGTH = 255;

function normalizeDestinationName(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function destinationKey(value) {
  return normalizeDestinationName(value).toLowerCase();
}

module.exports = {
  DESTINATION_STATE_STATUSES,
  MAX_DESTINATION_NAME_LENGTH,
  normalizeDestinationName,
  destinationKey,
};
