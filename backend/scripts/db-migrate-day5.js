require('dotenv').config();
const { sequelize, UserDestinationState } = require('../models');

const TABLE = 'user_destination_states';
const UNIQUE_INDEX = 'user_destination_states_user_lower_name';

async function tableExists(name) {
  const [rows] = await sequelize.query(
    'select 1 from information_schema.tables where table_name = :name limit 1',
    { replacements: { name } },
  );
  return rows.length > 0;
}

async function indexExists(name) {
  const [rows] = await sequelize.query(
    'select 1 from pg_indexes where indexname = :name limit 1',
    { replacements: { name } },
  );
  return rows.length > 0;
}

async function reportDrift() {
  const [rows] = await sequelize.query(
    'select column_name from information_schema.columns where table_name = :name',
    { replacements: { name: TABLE } },
  );

  const present = rows.map((row) => row.column_name);
  const expected = Object.values(UserDestinationState.rawAttributes)
    .map((attr) => attr.field || attr.fieldName);
  return expected.filter((column) => !present.includes(column));
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to Postgres.');

    const existedBefore = await tableExists(TABLE);
    if (existedBefore) {
      console.log(`Table "${TABLE}" already exists, ensuring index only.`);
    }

    await UserDestinationState.sync();
    console.log(`Ensured table ${TABLE} and enum enum_${TABLE}_status.`);

    if (await indexExists(UNIQUE_INDEX)) {
      console.log(`Index ${UNIQUE_INDEX} already exists, skipping.`);
    } else {
      await sequelize.query(
        `CREATE UNIQUE INDEX ${UNIQUE_INDEX} ON "${TABLE}" (user_id, lower(destination_name))`,
      );
      console.log(`Created unique index ${UNIQUE_INDEX} (user_id, lower(destination_name)).`);
    }

    const missing = await reportDrift();
    if (missing.length > 0) {
      console.error(`Migration incomplete, still missing: ${missing.join(', ')}`);
      process.exit(1);
    }

    if (!(await indexExists(UNIQUE_INDEX))) {
      console.error(`Migration incomplete, unique index ${UNIQUE_INDEX} is absent.`);
      process.exit(1);
    }

    console.log('Day 5 destination-state schema is in sync with the UserDestinationState model.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
