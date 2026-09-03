const { UserDestinationState } = require('../models');

async function getUserDestinationState(userId) {
  if (!userId) {
    return { all: [], visited: [], dismissed: [] };
  }

  const rows = await UserDestinationState.findAll({
    where: { userId },
    attributes: ['destinationName', 'status'],
    order: [['destinationName', 'ASC']],
  });

  const visited = rows.filter((row) => row.status === 'visited').map((row) => row.destinationName);
  const dismissed = rows.filter((row) => row.status === 'dismissed').map((row) => row.destinationName);

  return {
    all: [...visited, ...dismissed].sort((a, b) => a.localeCompare(b)),
    visited,
    dismissed,
  };
}

async function getUserExcludeList(userId) {
  const { all } = await getUserDestinationState(userId);
  return all;
}

module.exports = { getUserExcludeList, getUserDestinationState };
