// src/config/db.ts — Azure SQL Server connection pool + query helpers
import sql from 'mssql';
import { env } from './env.js';

export interface ExecuteResult {
  affectedRows: number;
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;

const buildConfig = (): sql.config => ({
  server: env.SQLSERVER_HOST,
  port: env.SQLSERVER_PORT,
  user: env.SQLSERVER_USER,
  password: env.SQLSERVER_PASSWORD,
  database: env.SQLSERVER_DATABASE,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 60000
  },
  options: {
    // Azure SQL requires encrypted connections. Set SQLSERVER_ENCRYPT=false
    // only for a local SQL Server without TLS.
    encrypt: env.SQLSERVER_ENCRYPT,
    trustServerCertificate: !env.SQLSERVER_ENCRYPT
  },
  requestTimeout: 30000
});

export const getDbPool = (): Promise<sql.ConnectionPool> => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig())
      .connect()
      .catch((error: unknown) => {
        poolPromise = null;
        throw error;
      });
  }
  return poolPromise;
};

export const checkDbConnection = async (): Promise<{ ok: boolean; message: string }> => {
  try {
    const pool = await getDbPool();
    await pool.request().query('SELECT 1 AS ok');
    return { ok: true, message: 'SQL Server connection successful' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SQL Server error';
    return { ok: false, message };
  }
};

/**
 * Rewrites mysql-style `?` placeholders to @p0..@pN and binds the params
 * onto the request. Our SQL never contains literal question marks.
 */
const prepareRequest = (
  request: sql.Request,
  sqlText: string,
  params: unknown[] = []
): string => {
  let index = 0;
  const text = sqlText.replace(/\?/g, () => `@p${index++}`);
  if (index !== params.length) {
    throw new Error(`SQL expects ${index} parameters but received ${params.length}`);
  }
  params.forEach((value, i) => {
    request.input(`p${i}`, value ?? null);
  });
  return text;
};

/**
 * SELECT helper
 * Example:
 *   interface UserRow { id: string; name: string; }
 *   const users = await queryRows<UserRow>('SELECT id, name FROM users WHERE id = ?', [id]);
 */
export async function queryRows<T = Record<string, unknown>>(
  sqlText: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = await getDbPool();
  const request = pool.request();
  const text = prepareRequest(request, sqlText, params);
  const result = await request.query<T>(text);
  return result.recordset ?? [];
}

/**
 * INSERT / UPDATE / DELETE / DDL helper
 * Example:
 *   const result = await execute('DELETE FROM users WHERE id = ?', [id]);
 *   console.log(result.affectedRows);
 */
export async function execute(
  sqlText: string,
  params?: unknown[]
): Promise<ExecuteResult> {
  const pool = await getDbPool();
  const request = pool.request();
  const text = prepareRequest(request, sqlText, params);
  const result = await request.query(text);
  return { affectedRows: result.rowsAffected.reduce((sum, count) => sum + count, 0) };
}

export interface DbTransaction {
  queryRows<T = Record<string, unknown>>(sqlText: string, params?: unknown[]): Promise<T[]>;
  execute(sqlText: string, params?: unknown[]): Promise<ExecuteResult>;
}

/**
 * Runs `fn` inside a transaction. Commits on success, rolls back on error.
 */
export async function withTransaction<T>(
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const pool = await getDbPool();
  const transaction = pool.transaction();
  await transaction.begin();

  const tx: DbTransaction = {
    async queryRows<R = Record<string, unknown>>(sqlText: string, params?: unknown[]) {
      const request = transaction.request();
      const text = prepareRequest(request, sqlText, params);
      const result = await request.query<R>(text);
      return result.recordset ?? [];
    },
    async execute(sqlText: string, params?: unknown[]) {
      const request = transaction.request();
      const text = prepareRequest(request, sqlText, params);
      const result = await request.query(text);
      return { affectedRows: result.rowsAffected.reduce((sum, count) => sum + count, 0) };
    }
  };

  try {
    const result = await fn(tx);
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // connection may already be dead; the original error matters more
    }
    throw error;
  }
}

/** SQL Server unique-constraint violation (2627: PK/unique constraint, 2601: unique index). */
export const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'number' in error &&
      ((error as { number?: number }).number === 2627 ||
        (error as { number?: number }).number === 2601)
  );

/**
 * Graceful shutdown (call once on app shutdown, not on every request)
 */
export async function closePool(): Promise<void> {
  if (poolPromise) {
    const pool = await poolPromise.catch(() => null);
    poolPromise = null;
    if (pool) {
      await pool.close();
      console.log('SQL Server pool closed');
    }
  }
}
