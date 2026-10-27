import { migrateAndSeed, pool } from './database';

try {
  const result = await migrateAndSeed();
  console.log(result.persistent ? `Database ready. Demo data ${result.seeded ? 'seeded' : 'already present'}.` : 'No DATABASE_URL; the app will use only data already cached on this device.');
} catch (error) {
  console.error('FairShift database migration failed. Check database connectivity and migration logs.');
  throw error;
} finally {
  await pool?.end();
}
