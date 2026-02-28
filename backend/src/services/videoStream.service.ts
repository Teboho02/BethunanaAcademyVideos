import type { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { getVideoAssetById } from './videoUpload.service.js';
import { HttpError } from '../types/index.js';
import {
  createLocalVideoRangeStream,
  getLocalVideoSize
} from './storage/localVideoStorage.service.js';
import { getS3ObjectRange, getS3ObjectSize } from './storage/s3.service.js';

interface ByteRange {
  start: number;
  end: number;
  contentLength: number;
  totalSize: number;
}

export interface VideoStreamPayload {
  statusCode: number;
  headers: Record<string, string>;
  stream: Readable;
}

const resolveByteRange = (
  rangeHeader: string | undefined,
  totalSize: number
): ByteRange => {
  if (totalSize <= 0) {
    throw new HttpError(404, 'Video content is empty');
  }

  const chunkSize = env.VIDEO_STREAM_CHUNK_SIZE;
  let start = 0;
  let end = Math.min(totalSize - 1, chunkSize - 1);

  if (rangeHeader?.startsWith('bytes=')) {
    const [rawStart, rawEnd] = rangeHeader.replace('bytes=', '').split('-');
    const parsedStart = Number(rawStart);
    const parsedEnd = rawEnd ? Number(rawEnd) : parsedStart + chunkSize - 1;

    if (Number.isNaN(parsedStart) || parsedStart < 0 || parsedStart >= totalSize) {
      throw new HttpError(416, 'Invalid range start');
    }

    start = parsedStart;
    end = Number.isNaN(parsedEnd) ? start + chunkSize - 1 : parsedEnd;
    end = Math.min(end, totalSize - 1);

    if (start > end) {
      throw new HttpError(416, 'Invalid range end');
    }
  }

  return {
    start,
    end,
    contentLength: end - start + 1,
    totalSize
  };
};

export const buildVideoStreamPayload = async (
  videoId: string,
  rangeHeader: string | undefined
): Promise<VideoStreamPayload> => {
  const video = await getVideoAssetById(videoId);
  if (!video) {
    throw new HttpError(404, 'Video not found');
  }

  let totalSize = video.sizeBytes;
  let stream: Readable;

  if (video.storageType === 'local') {
    if (!video.localPath) {
      throw new HttpError(500, 'Video local path is missing');
    }

    totalSize = await getLocalVideoSize(video.localPath);
    const range = resolveByteRange(rangeHeader, totalSize);
    stream = createLocalVideoRangeStream(video.localPath, range.start, range.end);

    return {
      statusCode: 206,
      headers: {
        'Content-Range': `bytes ${range.start}-${range.end}/${range.totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(range.contentLength),
        'Content-Type': video.mimeType || 'video/mp4',
        'Cache-Control': 'no-store'
      },
      stream
    };
  }

  if (!video.s3Key) {
    throw new HttpError(500, 'Video S3 key is missing');
  }

  totalSize = await getS3ObjectSize(video.s3Key);
  const range = resolveByteRange(rangeHeader, totalSize);
  stream = await getS3ObjectRange(video.s3Key, range.start, range.end);

  return {
    statusCode: 206,
    headers: {
      'Content-Range': `bytes ${range.start}-${range.end}/${range.totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(range.contentLength),
      'Content-Type': video.mimeType || 'video/mp4',
      'Cache-Control': 'no-store'
    },
    stream
  };
};
