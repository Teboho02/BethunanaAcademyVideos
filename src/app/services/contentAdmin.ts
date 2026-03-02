export async function deleteVideo(videoId: string): Promise<void> {
  const response = await fetch(`/api/content/videos/${videoId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      throw new Error(payload.message ?? payload.error ?? `Request failed (${response.status})`);
    } catch {
      throw new Error(`Request failed (${response.status})`);
    }
  }
}

export async function createTopic(subjectId: string, name: string): Promise<{ id: string; name: string; subjectId: string }> {
  const response = await fetch('/api/content/topics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ subjectId, name }),
  });

  if (!response.ok) {
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      throw new Error(payload.message ?? payload.error ?? `Request failed (${response.status})`);
    } catch {
      throw new Error(`Request failed (${response.status})`);
    }
  }

  const payload = (await response.json()) as { data?: { id?: string; name?: string; subjectId?: string } };
  const topic = payload.data;
  if (!topic?.id || !topic?.name || !topic?.subjectId) {
    throw new Error('Unexpected topic create response');
  }
  return { id: topic.id, name: topic.name, subjectId: topic.subjectId };
}
