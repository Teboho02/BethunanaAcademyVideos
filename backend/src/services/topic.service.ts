import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getMySqlPool } from '../config/mysql.js';
import { HttpError } from '../types/index.js';

export interface TopicWithSubject {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  videoCount: number;
}

interface TopicRow extends RowDataPacket {
  id: number;
  name: string;
  subject_code: string;
  subject_name: string;
  video_count: number;
}

interface SubjectRow extends RowDataPacket {
  id: number;
  code: string;
}

const parseGradeFromSubjectCode = (subjectCode: string): number => {
  const match = /^g(\d+)-/i.exec(subjectCode.trim());
  if (!match) return 0;
  const grade = Number(match[1]);
  return Number.isFinite(grade) ? grade : 0;
};

const rowToTopic = (row: TopicRow): TopicWithSubject => {
  return {
    id: String(row.id),
    name: row.name,
    subjectId: row.subject_code,
    subjectName: row.subject_name,
    grade: parseGradeFromSubjectCode(row.subject_code),
    videoCount: Number(row.video_count),
  };
};

const TOPIC_SELECT = `
  SELECT t.id, t.name, s.code AS subject_code, s.name AS subject_name,
         COUNT(v.id) AS video_count
  FROM topics t
  JOIN subjects s ON s.id = t.subject_id
  LEFT JOIN videos v ON v.topic_id = t.id AND v.status = 'published'
  WHERE t.is_active = 1 AND s.is_active = 1
`;

export const listTopics = async (): Promise<TopicWithSubject[]> => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<TopicRow[]>(
    `${TOPIC_SELECT} GROUP BY t.id, t.name, s.code, s.name ORDER BY s.code, t.sort_order, t.name`
  );
  return rows.map(rowToTopic);
};

export const createTopic = async (
  subjectCode: string,
  name: string
): Promise<TopicWithSubject> => {
  const cleanSubjectCode = subjectCode.trim();
  const cleanName = name.trim();
  if (!cleanName) throw new HttpError(400, 'Topic name is required');
  if (!cleanSubjectCode) throw new HttpError(400, 'Subject id is required');

  const pool = getMySqlPool();
  const [subjectRows] = await pool.query<SubjectRow[]>(
    'SELECT id, code FROM subjects WHERE code = ? AND is_active = 1 LIMIT 1',
    [cleanSubjectCode]
  );
  const subjectDbId = subjectRows[0]?.id;
  if (!subjectDbId) throw new HttpError(404, 'Subject not found');

  await pool.query(
    'INSERT IGNORE INTO topics (subject_id, name, sort_order) VALUES (?, ?, 0)',
    [subjectDbId, cleanName]
  );

  const [rows] = await pool.query<TopicRow[]>(
    `${TOPIC_SELECT} AND t.subject_id = ? AND t.name = ? GROUP BY t.id, t.name, s.code, s.name`,
    [subjectDbId, cleanName]
  );
  if (!rows[0]) throw new HttpError(500, 'Failed to create topic');

  return rowToTopic(rows[0]);
};

export const renameTopic = async (
  topicId: string,
  name: string
): Promise<TopicWithSubject> => {
  const cleanName = name.trim();
  if (!cleanName) throw new HttpError(400, 'Topic name is required');

  const pool = getMySqlPool();

  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE topics SET name = ?, updated_at = NOW() WHERE id = ?',
    [cleanName, topicId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Topic not found');

  const [rows] = await pool.query<TopicRow[]>(
    `${TOPIC_SELECT} AND t.id = ? GROUP BY t.id, t.name, s.code, s.name`,
    [topicId]
  );
  if (!rows[0]) throw new HttpError(404, 'Topic not found after update');
  return rowToTopic(rows[0]);
};

export const deleteTopic = async (topicId: string): Promise<void> => {
  const pool = getMySqlPool();

  const [videoRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM videos WHERE topic_id = ? AND status = "published"',
    [topicId]
  );
  const videoCount = Number((videoRows[0] as any)?.count ?? 0);
  if (videoCount > 0) {
    throw new HttpError(
      409,
      `Cannot delete: this topic has ${videoCount} video${videoCount > 1 ? 's' : ''} attached. Remove the videos first.`
    );
  }

  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM topics WHERE id = ?',
    [topicId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Topic not found');
};
