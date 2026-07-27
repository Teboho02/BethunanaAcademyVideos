import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the DB layer: a single in-memory active_session_id the service reads/writes.
let dbSid: string | null = null;
let queryCount = 0;

vi.mock('../config/db.js', () => ({
  execute: async (sql: string, params: unknown[] = []) => {
    if (/active_session_id = NULL/.test(sql)) dbSid = null;
    else if (/active_session_id = \?/.test(sql)) dbSid = params[0] as string;
    return { affectedRows: 1 };
  },
  queryRows: async () => {
    queryCount++;
    return [{ active_session_id: dbSid }];
  }
}));

const { startSession, endSession, isSessionActive } = await import('../services/session.service.js');

const SN = 'BNA123456';

beforeEach(() => {
  dbSid = null;
  queryCount = 0;
});

describe('single active session', () => {
  it('startSession stores a new sid and returns it', async () => {
    const sid = await startSession(SN);
    expect(typeof sid).toBe('string');
    expect(dbSid).toBe(sid);
  });

  it('accepts the current sid and rejects others', async () => {
    const sid = await startSession(SN);
    expect(await isSessionActive(SN, sid)).toBe(true);
    expect(await isSessionActive(SN, 'not-the-sid')).toBe(false);
  });

  it('a second login supersedes the first device', async () => {
    const first = await startSession(SN);
    expect(await isSessionActive(SN, first)).toBe(true);

    const second = await startSession(SN);
    expect(second).not.toBe(first);
    // First device's token is now rejected; the new one is accepted.
    expect(await isSessionActive(SN, first)).toBe(false);
    expect(await isSessionActive(SN, second)).toBe(true);
  });

  it('caches a positive match (no DB read on the 2nd identical check)', async () => {
    const sid = await startSession(SN); // startSession evicts the cache
    queryCount = 0;
    expect(await isSessionActive(SN, sid)).toBe(true); // miss -> 1 DB read
    expect(queryCount).toBe(1);
    expect(await isSessionActive(SN, sid)).toBe(true); // served from cache
    expect(queryCount).toBe(1);
  });

  it('re-reads the DB on a mismatch so a fresh login is never wrongly rejected', async () => {
    const first = await startSession(SN);
    await isSessionActive(SN, first); // warms cache with `first`
    // Simulate another instance changing the DB without touching this cache.
    dbSid = 'brand-new-sid-from-another-instance';
    queryCount = 0;
    // A request bearing the new sid mismatches the cache -> forces a DB re-read -> accepted.
    expect(await isSessionActive(SN, 'brand-new-sid-from-another-instance')).toBe(true);
    expect(queryCount).toBe(1);
  });

  it('endSession clears the active session', async () => {
    const sid = await startSession(SN);
    await endSession(SN);
    expect(dbSid).toBeNull();
    expect(await isSessionActive(SN, sid)).toBe(false);
  });
});
