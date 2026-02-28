const TOPICS_API = '/api/admin/topics';

export interface TopicWithSubject {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  videoCount: number;
}

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

export async function fetchTopics(): Promise<TopicWithSubject[]> {
  const response = await fetch(TOPICS_API, { credentials: 'include' });
  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as { data: TopicWithSubject[] };
  return payload.data;
}

export async function createTopic(subjectId: string, name: string): Promise<TopicWithSubject> {
  const response = await fetch(TOPICS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ subjectId, name }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as { data: TopicWithSubject };
  return payload.data;
}

export async function renameTopic(topicId: string, name: string): Promise<TopicWithSubject> {
  const response = await fetch(`${TOPICS_API}/${topicId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as { data: TopicWithSubject };
  return payload.data;
}

export async function deleteTopic(topicId: string): Promise<void> {
  const response = await fetch(`${TOPICS_API}/${topicId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await parseError(response));
}
