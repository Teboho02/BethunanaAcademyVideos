import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { HttpError } from '../../types/index.js';

const storageRoot = path.resolve(process.cwd(), env.LOCAL_VIDEO_STORAGE_PATH);

const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-zA-Z0-9._-]/g, '_');

const assertInStorageRoot = (absolutePath: string): void => {
  if (!absolutePath.startsWith(storageRoot)) {
    throw new HttpError(400, 'Invalid local storage path');
  }
};

export const ensureLocalStorageRoot = async (): Promise<void> => {
  await mkdir(storageRoot, { recursive: true });
};

export const saveVideoToLocalStorage = async (
  file: Express.Multer.File
): Promise<{ storageKey: string; absolutePath: string }> => {
  await ensureLocalStorageRoot();

  const key = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${sanitizeFilename(file.originalname)}`;
  const absolutePath = path.resolve(storageRoot, key);
  assertInStorageRoot(absolutePath);

  await writeFile(absolutePath, file.buffer);
  return { storageKey: key, absolutePath };
};

export const saveThumbnailToLocalStorage = async (
  file: Express.Multer.File
): Promise<{ storageKey: string; absolutePath: string }> => {
  await ensureLocalStorageRoot();

  const key = `thumbnails/${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${sanitizeFilename(file.originalname)}`;
  const absolutePath = path.resolve(storageRoot, key);
  assertInStorageRoot(absolutePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, file.buffer);
  return { storageKey: key, absolutePath };
};

export const resolveLocalVideoPath = (storageKey: string): string => {
  const absolutePath = path.resolve(storageRoot, storageKey);
  assertInStorageRoot(absolutePath);
  return absolutePath;
};

export const getLocalVideoSize = async (storageKey: string): Promise<number> => {
  const absolutePath = resolveLocalVideoPath(storageKey);
  const fileStats = await stat(absolutePath);
  return fileStats.size;
};

export const createLocalVideoRangeStream = (
  storageKey: string,
  start: number,
  end: number
) => {
  const absolutePath = resolveLocalVideoPath(storageKey);
  return createReadStream(absolutePath, { start, end });
};

export const createLocalFileStream = (storageKey: string) => {
  const absolutePath = resolveLocalVideoPath(storageKey);
  return createReadStream(absolutePath);
};

export const deleteLocalFile = async (storageKey: string): Promise<void> => {
  const absolutePath = resolveLocalVideoPath(storageKey);
  await unlink(absolutePath);
};
