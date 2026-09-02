require('dotenv').config();
const { sequelize } = require('../models');
const { HEAT_TIERS, SLOT_TYPES, ITINERARY_SOURCES } = require('../utils/itineraryContract');

const TABLE = 'itineraries';

const ENUM_TYPES = [
  { name: 'enum_itineraries_slot_type', values: SLOT_TYPES },
  { name: 'enum_itineraries_heat_tier', values: HEAT_TIERS },
  { name: 'enum_itineraries_source', values: ITINERARY_SOURCES },
];

const COLUMNS = [
  { name: 'hazard_context', definition: 'JSONB' },
  { name: 'slot_type', definition: 'enum_itineraries_slot_type' },
  { name: 'heat_tier', definition: 'enum_itineraries_heat_tier' },
  { name: 'needs_marketplace_data', definition: 'BOOLEAN NOT NULL DEFAULT false' },
  { name: 'fallback_message', definition: 'TEXT' },
  { name: 'source', definition: "enum_itineraries_source NOT NULL DEFAULT 'ml'" },
  { name: 'model_version', definition: 'VARCHAR(255)' },
];

async function enumExists(name, transaction) {
  const [rows] = await sequelize.query(
    'select 1 from pg_type where typname = :name limit 1',
    { replacements: { name }, transaction },
  );
  return rows.length > 0;
}

async function tableExists(name) {
  const [rows] = await sequelize.query(
    'select 1 from information_schema.tables where table_name = :name limit 1',
    { replacements: { name } },
  );
  return rows.length > 0;
}

async function reportDrift() {
  const model = sequelize.models.Itinerary;
  const [rows] = await sequelize.query(
    'select column_name from information_schema.columns where table_name = :name',
    { replacements: { name: TABLE } },
  );

  const present = rows.map((row) => row.column_name);
  const expected = Object.values(model.rawAttributes).map((attr) => attr.field || attr.fieldName);
  return expected.filter((column) => !present.includes(column));
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to Postgres.');

    if (!(await tableExists(TABLE))) {
      console.error(`Table "${TABLE}" does not exist. Run "npm run db:sync" first to create the base schema.`);
      process.exit(1);
    }

    const transaction = await sequelize.transaction();

    try {
      for (const enumType of ENUM_TYPES) {
        if (await enumExists(enumType.name, transaction)) {
          console.log(`Enum ${enumType.name} already exists, skipping.`);
          continue;
        }

        const labels = enumType.values.map((value) => `'${value}'`).join(', ');
        await sequelize.query(`CREATE TYPE ${enumType.name} AS ENUM (${labels})`, { transaction });
        console.log(`Created enum ${enumType.name} (${enumType.values.join(', ')}).`);
      }

      for (const column of COLUMNS) {
        await sequelize.query(
          `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${column.name}" ${column.definition}`,
          { transaction },
        );
        console.log(`Ensured column ${TABLE}.${column.name}.`);
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    const missing = await reportDrift();

    if (missing.length > 0) {
      console.error(`Migration incomplete, still missing: ${missing.join(', ')}`);
      process.exit(1);
    }

    console.log('Day 4 itinerary schema is in sync with the Itinerary model.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
