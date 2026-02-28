import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.LOCAL_VIDEO_STORAGE_PATH = './storage/test-videos';
process.env.CORS_ORIGIN = '*';

const testStoragePath = path.resolve(process.cwd(), process.env.LOCAL_VIDEO_STORAGE_PATH);

beforeEach(async () => {
  await rm(testStoragePath, { recursive: true, force: true });
});

afterEach(async () => {
  await rm(testStoragePath, { recursive: true, force: true });
});
