import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { HttpError } from '../../types/index.js';

const buildS3Client = (): S3Client => {
  const hasStaticCredentials = env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY;

  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: hasStaticCredentials
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY
        }
      : undefined
  });
};

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = buildS3Client();
  }
  return s3Client;
};

const ensureS3Configured = (): void => {
  if (!env.S3_REGION || !env.S3_BUCKET) {
    throw new HttpError(500, 'S3 is not configured. Set S3_REGION and S3_BUCKET.');
  }
};

const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-zA-Z0-9._-]/g, '_');

export const buildS3VideoKey = (originalFilename: string): string => {
  const now = Date.now();
  const random = Math.floor(Math.random() * 1_000_000);
  return `videos/${now}-${random}-${sanitizeFilename(originalFilename)}`;
};

export const buildS3ThumbnailKey = (originalFilename: string): string => {
  const now = Date.now();
  const random = Math.floor(Math.random() * 1_000_000);
  return `thumbnails/${now}-${random}-${sanitizeFilename(originalFilename)}`;
};

export const uploadBufferToS3 = async (
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> => {
  ensureS3Configured();
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );
};

export const getS3ObjectSize = async (key: string): Promise<number> => {
  ensureS3Configured();

  const s3 = getS3Client();
  const result = await s3.send(
    new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key
    })
  );

  if (!result.ContentLength || result.ContentLength <= 0) {
    throw new HttpError(404, 'S3 object not found or has no content');
  }

  return result.ContentLength;
};

export const getS3ObjectRange = async (
  key: string,
  start: number,
  end: number
): Promise<Readable> => {
  ensureS3Configured();

  const s3 = getS3Client();
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Range: `bytes=${start}-${end}`
    })
  );

  if (!result.Body) {
    throw new HttpError(404, 'S3 object stream is empty');
  }

  return result.Body as Readable;
};

export const getS3Object = async (
  key: string
): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> => {
  ensureS3Configured();

  const s3 = getS3Client();
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key
    })
  );

  if (!result.Body) {
    throw new HttpError(404, 'S3 object stream is empty');
  }

  return {
    stream: result.Body as Readable,
    contentType: result.ContentType,
    contentLength: result.ContentLength
  };
};
