import multer from 'multer';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { uploadVideoAndRegister, listVideoAssets, getVideoAssetById, deleteVideoAsset } from '../services/videoUpload.service.js';
import { buildVideoStreamPayload } from '../services/videoStream.service.js';
import { createLocalFileStream, getLocalVideoSize } from '../services/storage/localVideoStorage.service.js';
import { getS3Object } from '../services/storage/s3.service.js';
import {
  getVideoAnalytics,
  getWatchProgress,
  listAllVideoAnalytics,
  saveWatchProgress
} from '../services/watchProgress.service.js';
import { HttpError } from '../types/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 2
  }
});

export const uploadVideoMiddleware = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

export const uploadVideoHandler: RequestHandler = async (req, res, next) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];

    if (!videoFile) {
      throw new HttpError(400, 'Video file is required');
    }

    const title =
      typeof req.body.title === 'string' && req.body.title.trim().length > 0
        ? req.body.title
        : videoFile.originalname;

    const video = await uploadVideoAndRegister(videoFile, {
      title,
      description: typeof req.body.description === 'string' ? req.body.description : '',
      subjectId: typeof req.body.subjectId === 'string' ? req.body.subjectId : undefined,
      topicId: typeof req.body.topicId === 'string' ? req.body.topicId : undefined,
      thumbnailFile
    });

    res.status(201).json({
      success: true,
      data: video,
      message: 'Video uploaded successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const listVideosHandler: RequestHandler = async (_req, res, next) => {
  try {
    const videos = await listVideoAssets();
    res.status(200).json({
      success: true,
      data: videos
    });
  } catch (error) {
    next(error);
  }
};

export const streamVideoHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = req.params.id;
    if (!videoId) {
      throw new HttpError(400, 'Video id is required');
    }

    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const payload = await buildVideoStreamPayload(videoId, rangeHeader);

    res.status(payload.statusCode);
    for (const [key, value] of Object.entries(payload.headers)) {
      res.setHeader(key, value);
    }

    payload.stream.on('error', next);
    payload.stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const streamVideoThumbnailHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = req.params.id;
    if (!videoId) {
      throw new HttpError(400, 'Video id is required');
    }

    const video = await getVideoAssetById(videoId);

    if (!video) {
      throw new HttpError(404, 'Video not found');
    }

    if (!video.thumbnailStorageType) {
      throw new HttpError(404, 'Thumbnail not found');
    }

    if (video.thumbnailStorageType === 'local') {
      if (!video.thumbnailLocalPath) {
        throw new HttpError(404, 'Thumbnail not found');
      }

      const contentLength = await getLocalVideoSize(video.thumbnailLocalPath);
      const stream = createLocalFileStream(video.thumbnailLocalPath);

      res.status(200);
      res.setHeader('Content-Type', video.thumbnailMimeType ?? 'image/jpeg');
      res.setHeader('Content-Length', String(contentLength));
      res.setHeader('Cache-Control', 'public, max-age=86400');

      stream.on('error', next);
      stream.pipe(res);
      return;
    }

    if (!video.thumbnailS3Key) {
      throw new HttpError(404, 'Thumbnail not found');
    }

    const cdnBase = normalizeBaseUrl(env.CDN_BASE_URL);
    if (cdnBase) {
      const path = video.thumbnailS3Key.replace(/^\/+/, '');
      res.redirect(302, `${cdnBase}/${path}`);
      return;
    }

    const object = await getS3Object(video.thumbnailS3Key);
    res.status(200);
    res.setHeader('Content-Type', video.thumbnailMimeType ?? object.contentType ?? 'image/jpeg');
    if (Number.isFinite(object.contentLength) && Number(object.contentLength) > 0) {
      res.setHeader('Content-Length', String(Number(object.contentLength)));
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');

    object.stream.on('error', next);
    object.stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const saveWatchProgressHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = typeof req.params.id === 'string' ? req.params.id : '';
    const studentNumber =
      typeof req.body.studentNumber === 'string' ? req.body.studentNumber : '';
    const positionSeconds = req.body.positionSeconds;
    const watchedSecondsDelta = req.body.watchedSecondsDelta;

    const saved = await saveWatchProgress(
      videoId,
      studentNumber,
      positionSeconds,
      watchedSecondsDelta
    );
    res.status(200).json({
      success: true,
      data: saved
    });
  } catch (error) {
    next(error);
  }
};

export const getWatchProgressHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = typeof req.params.id === 'string' ? req.params.id : '';
    const studentNumber =
      typeof req.query.studentNumber === 'string' ? req.query.studentNumber : '';

    if (!videoId.trim()) {
      throw new HttpError(400, 'Video id is required');
    }
    if (!studentNumber.trim()) {
      throw new HttpError(400, 'Student number is required');
    }

    const progress = await getWatchProgress(videoId, studentNumber);
    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
};

export const getVideoAnalyticsHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!videoId.trim()) {
      throw new HttpError(400, 'Video id is required');
    }

    res.status(200).json({
      success: true,
      data: await getVideoAnalytics(videoId)
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVideoHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!videoId) throw new HttpError(400, 'Video id is required');

    await deleteVideoAsset(videoId);
    res.status(200).json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const listVideoAnalyticsHandler: RequestHandler = async (_req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await listAllVideoAnalytics()
    });
  } catch (error) {
    next(error);
  }
};
