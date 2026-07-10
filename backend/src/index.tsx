import app from './app.js';
import { env } from './config/env.js';
import { checkDbConnection } from './config/db.js';
import { ensureMediaJobsTable } from './services/mediaJobs.service.js';
import { ensurePasswordHashColumn } from './services/migrations.service.js';

const startServer = async (): Promise<void> => {
  const dbHealth = await checkDbConnection();
  if (!dbHealth.ok) {
    throw new Error(`SQL Server check failed: ${dbHealth.message}`);
  }
  await ensureMediaJobsTable();
  await ensurePasswordHashColumn();
  console.info('[backend] SQL Server connection verified.');

  app.listen(env.PORT, () => {
    console.info(`[backend] API server listening on http://localhost:${env.PORT}`);
  });
};

startServer().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`[backend] Failed to start server: ${message}`);
  process.exit(1);
});
