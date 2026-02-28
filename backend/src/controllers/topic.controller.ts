import type { RequestHandler } from 'express';
import { createTopic, deleteTopic, listTopics, renameTopic } from '../services/topic.service.js';
import { HttpError } from '../types/index.js';

export const listTopicsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const topics = await listTopics();
    res.status(200).json({ success: true, data: topics });
  } catch (error) {
    next(error);
  }
};

export const createTopicHandler: RequestHandler = async (req, res, next) => {
  try {
    const subjectId = typeof req.body.subjectId === 'string' ? req.body.subjectId : '';
    const name = typeof req.body.name === 'string' ? req.body.name : '';

    if (!subjectId.trim()) throw new HttpError(400, 'Subject id is required');
    if (!name.trim()) throw new HttpError(400, 'Topic name is required');

    const topic = await createTopic(subjectId, name);
    res.status(201).json({ success: true, data: topic, message: 'Topic created successfully' });
  } catch (error) {
    next(error);
  }
};

export const renameTopicHandler: RequestHandler = async (req, res, next) => {
  try {
    const topicId = req.params.id ?? '';
    const name = typeof req.body.name === 'string' ? req.body.name : '';

    if (!topicId) throw new HttpError(400, 'Topic id is required');
    if (!name.trim()) throw new HttpError(400, 'Topic name is required');

    const topic = await renameTopic(topicId, name);
    res.status(200).json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
};

export const deleteTopicHandler: RequestHandler = async (req, res, next) => {
  try {
    const topicId = req.params.id ?? '';
    if (!topicId) throw new HttpError(400, 'Topic id is required');

    await deleteTopic(topicId);
    res.status(200).json({ success: true, message: 'Topic deleted successfully' });
  } catch (error) {
    next(error);
  }
};
