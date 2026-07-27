import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbTransaction } from '../config/db.js';

// Captures every SQL statement the service runs against the (mocked) DB so we
// can assert the exact WHERE clause and bound parameters per delete mode.
interface Captured {
  text: string;
  params: unknown[];
}
const calls: Captured[] = [];
let countValue = 0;

vi.mock('../config/db.js', () => ({
  withTransaction: async <T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> => {
    const tx: DbTransaction = {
      async queryRows(text: string, params: unknown[] = []) {
        calls.push({ text, params });
        return [{ n: countValue }] as never;
      },
      async execute(text: string, params: unknown[] = []) {
        calls.push({ text, params });
        return { affectedRows: countValue };
      }
    };
    return fn(tx);
  },
  execute: async () => ({ affectedRows: 0 }),
  queryRows: async () => [],
  isDuplicateKeyError: () => false
}));

const { bulkRemoveStudents } = await import('../services/student.service.js');
const { HttpError } = await import('../types/index.js');

const selectCalls = () => calls.filter((c) => c.text.includes('SELECT'));
const deleteCalls = () => calls.filter((c) => c.text.includes('DELETE'));

beforeEach(() => {
  calls.length = 0;
  countValue = 0;
});

describe('bulkRemoveStudents', () => {
  it('all=true deletes every student and returns the counted total', async () => {
    countValue = 7;
    const deleted = await bulkRemoveStudents({ all: true });

    expect(deleted).toBe(7);
    expect(deleteCalls()).toHaveLength(1);
    const del = deleteCalls()[0];
    expect(del.text).toContain(`role = 'student'`);
    expect(del.text).not.toContain('grade_level');
    expect(del.text).not.toContain('IN (');
    expect(del.params).toEqual([]);
  });

  it('grade mode scopes the delete to that grade', async () => {
    countValue = 3;
    const deleted = await bulkRemoveStudents({ grade: 10 });

    expect(deleted).toBe(3);
    const del = deleteCalls()[0];
    expect(del.text).toContain('grade_level = ?');
    expect(del.params).toEqual([10]);
  });

  it('rejects an invalid grade before touching the database', async () => {
    await expect(bulkRemoveStudents({ grade: 7 })).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(0);
  });

  it('ids mode builds one placeholder per id and binds them in order', async () => {
    countValue = 2;
    const ids = ['a1', 'b2'];
    const deleted = await bulkRemoveStudents({ ids });

    expect(deleted).toBe(2);
    const del = deleteCalls()[0];
    expect(del.text).toContain('IN (?, ?)');
    expect(del.params).toEqual(ids);
  });

  it('precedence: all wins over grade wins over ids', async () => {
    countValue = 9;
    await bulkRemoveStudents({ all: true, grade: 10, ids: ['x'] });
    expect(deleteCalls()[0].text).not.toContain('grade_level');
    expect(deleteCalls()[0].text).not.toContain('IN (');
  });

  it('empty ids list is a no-op that never opens a transaction', async () => {
    const deleted = await bulkRemoveStudents({ ids: [] });
    expect(deleted).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('blank/whitespace ids are filtered out', async () => {
    countValue = 1;
    const deleted = await bulkRemoveStudents({ ids: ['  ', 'real'] });
    expect(deleted).toBe(1);
    expect(deleteCalls()[0].text).toContain('IN (?)');
    expect(deleteCalls()[0].params).toEqual(['real']);
  });

  it('when nothing matches, it counts but issues no DELETE', async () => {
    countValue = 0;
    const deleted = await bulkRemoveStudents({ grade: 12 });
    expect(deleted).toBe(0);
    expect(selectCalls()).toHaveLength(1);
    expect(deleteCalls()).toHaveLength(0);
  });
});
