require('dotenv').config();
const { sequelize } = require('../models');

const ENUM_ADDITIONS = [
  { type: 'enum_bookings_status', value: 'requested', before: 'pending' },
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to Postgres.');

    for (const addition of ENUM_ADDITIONS) {
      const [existing] = await sequelize.query(
        'select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname = :type limit 1',
        { replacements: { type: addition.type } },
      );

      if (existing.length === 0) {
        console.log(`Enum ${addition.type} does not exist yet, sync will create it.`);
        continue;
      }

      await sequelize.query(
        `ALTER TYPE ${addition.type} ADD VALUE IF NOT EXISTS '${addition.value}' BEFORE '${addition.before}'`,
      );
      console.log(`Enum ${addition.type} now includes '${addition.value}'.`);
    }

    await sequelize.sync({ alter: true });
    console.log('All models synced successfully.');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
