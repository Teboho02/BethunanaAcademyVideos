import { randomUUID } from 'node:crypto';
import { execute, queryRows } from '../config/db.js';

// Single active session per account. The id of the currently-allowed session is
// stored on users.active_session_id and embedded in the session JWT as "sid";
// a request whose sid does not match is rejected, so a new login signs every
// other device out.

const TTL_MS = 30_000;
const cache = new Map<string, { sid: string | null; expires: number }>();
const keyOf = (studentNumber: string) => studentNumber.trim().toLowerCase();

/** Begins a new active session for the account, superseding any other device. */
export async function startSession(studentNumber: string): Promise<string> {
  const sid = randomUUID();
  await execute(
    `UPDATE users SET active_session_id = ?, updated_at = GETDATE()
      WHERE LOWER(student_number) = LOWER(?)`,
    [sid, studentNumber]
  );
  cache.delete(keyOf(studentNumber));
  return sid;
}

/** Clears the active session (best-effort, on logout). */
export async function endSession(studentNumber: string): Promise<void> {
  await execute(
    `UPDATE users SET active_session_id = NULL, updated_at = GETDATE()
      WHERE LOWER(student_number) = LOWER(?)`,
    [studentNumber]
  );
  cache.delete(keyOf(studentNumber));
}

/**
 * True if `sid` is the account's current active session. Backed by a ~30s
 * cache; on a cache miss OR mismatch we re-read the DB, so a brand-new login is
 * never wrongly rejected and a superseded device is booted within the TTL.
 */
export async function isSessionActive(studentNumber: string, sid: string): Promise<boolean> {
  const key = keyOf(studentNumber);
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && hit.expires > now && hit.sid === sid) return true;

  const rows = await queryRows<{ active_session_id: string | null }>(
    `SELECT TOP 1 active_session_id FROM users WHERE LOWER(student_number) = LOWER(?)`,
    [studentNumber]
  );
  const dbSid = rows[0]?.active_session_id ?? null;
  cache.set(key, { sid: dbSid, expires: now + TTL_MS });
  return dbSid !== null && dbSid === sid;
}
