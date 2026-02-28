// src/config/mysql.ts
import mysql, {
  Pool,
  RowDataPacket,
  ResultSetHeader,
} from 'mysql2/promise';
import { env } from './env.js';

let pool: Pool | null = null;

export const getMySqlPool = (): Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
};

export const checkMySqlConnection = async (): Promise<{ ok: boolean; message: string }> => {
  try {
    const connection = await getMySqlPool().getConnection();
    await connection.ping();
    connection.release();
    return { ok: true, message: 'MySQL connection successful' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown MySQL error';
    return { ok: false, message };
  }
};

/**
 * SELECT helper
 * Example:
 *   interface UserRow extends RowDataPacket { id: number; name: string; }
 *   const users = await queryRows<UserRow>('SELECT id, name FROM users');
 */
export async function queryRows<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const [rows] = await getMySqlPool().execute<T[]>(sql, params as any);
  return rows;
}

/**
 * INSERT / UPDATE / DELETE helper
 * Example:
 *   const result = await execute(
 *     'INSERT INTO users (name, email) VALUES (?, ?)',
 *     [name, email],
 *   );
 *   console.log(result.insertId);
 */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<ResultSetHeader> {
  const [result] = await getMySqlPool().execute<ResultSetHeader>(sql, params as any);
  return result;
}

/**
 * Graceful shutdown (call once on app shutdown, not on every request)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('MySQL pool closed');
  }
}
