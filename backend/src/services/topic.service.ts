import { execute, queryRows } from '../config/db.js';
import { HttpError } from '../types/index.js';

export interface TopicWithSubject {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  videoCount: number;
}

interface TopicRow {
  id: number;
  name: string;
  subject_code: string;
  subject_name: string;
  video_count: number;
}

interface SubjectRow {
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

// SQL Server requires ORDER BY columns (t.sort_order) to appear in GROUP BY.
const TOPIC_GROUP_BY = 'GROUP BY t.id, t.name, t.sort_order, s.code, s.name';

export const listTopics = async (): Promise<TopicWithSubject[]> => {
  const rows = await queryRows<TopicRow>(
    `${TOPIC_SELECT} ${TOPIC_GROUP_BY} ORDER BY s.code, t.sort_order, t.name`
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

  const subjectRows = await queryRows<SubjectRow>(
    'SELECT TOP 1 id, code FROM subjects WHERE code = ? AND is_active = 1',
    [cleanSubjectCode]
  );
  const subjectDbId = subjectRows[0]?.id;
  if (!subjectDbId) throw new HttpError(404, 'Subject not found');

  await execute(
    `IF NOT EXISTS (SELECT 1 FROM topics WHERE subject_id = ? AND name = ?)
       INSERT INTO topics (subject_id, name, sort_order) VALUES (?, ?, 0)`,
    [subjectDbId, cleanName, subjectDbId, cleanName]
  );

  const rows = await queryRows<TopicRow>(
    `${TOPIC_SELECT} AND t.subject_id = ? AND t.name = ? ${TOPIC_GROUP_BY}`,
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

  const result = await execute(
    'UPDATE topics SET name = ?, updated_at = GETDATE() WHERE id = ?',
    [cleanName, topicId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Topic not found');

  const rows = await queryRows<TopicRow>(
    `${TOPIC_SELECT} AND t.id = ? ${TOPIC_GROUP_BY}`,
    [topicId]
  );
  if (!rows[0]) throw new HttpError(404, 'Topic not found after update');
  return rowToTopic(rows[0]);
};

export const deleteTopic = async (topicId: string): Promise<void> => {
  const videoRows = await queryRows<{ count: number }>(
    "SELECT COUNT(*) AS count FROM videos WHERE topic_id = ? AND status = 'published'",
    [topicId]
  );
  const videoCount = Number(videoRows[0]?.count ?? 0);
  if (videoCount > 0) {
    throw new HttpError(
      409,
      `Cannot delete: this topic has ${videoCount} video${videoCount > 1 ? 's' : ''} attached. Remove the videos first.`
    );
  }

  const result = await execute(
    'DELETE FROM topics WHERE id = ?',
    [topicId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Topic not found');
};
