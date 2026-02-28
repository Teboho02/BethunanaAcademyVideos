import type { RequestHandler } from 'express';
import { getCatalogPayload, getCatalogVideoById } from '../data/contentCatalog.js';
import { createTopic } from '../services/topic.service.js';
import { HttpError } from '../types/index.js';

export const getCatalogHandler: RequestHandler = async (_req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await getCatalogPayload()
    });
  } catch (error) {
    next(error);
  }
};

export const getCatalogVideoHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = req.params.id;
    if (!videoId) {
      res.status(400).json({ success: false, error: 'Video id is required' });
      return;
    }

    const video = await getCatalogVideoById(videoId);
    if (!video) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    res.status(200).json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

export const createCatalogTopicHandler: RequestHandler = async (req, res, next) => {
  try {
    const subjectId =
      typeof req.body.subjectId === 'string' ? req.body.subjectId : '';
    const name = typeof req.body.name === 'string' ? req.body.name : '';

    if (!subjectId.trim()) throw new HttpError(400, 'Subject id is required');
    if (!name.trim()) throw new HttpError(400, 'Topic name is required');

    const topic = await createTopic(subjectId, name);
    res.status(201).json({
      success: true,
      data: { id: topic.id, name: topic.name, subjectId: topic.subjectId },
      message: 'Topic created successfully'
    });
  } catch (error) {
    next(error);
  }
};
