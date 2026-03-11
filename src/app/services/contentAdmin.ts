async function getErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      return payload.message ?? payload.error ?? fallback;
    } catch {
      return fallback;
    }
  }

  try {
    const text = (await response.text()).trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export async function deleteVideo(videoId: string): Promise<void> {
  const encodedId = encodeURIComponent(videoId);
  const endpoints = [`/api/videos/${encodedId}`, `/api/content/videos/${encodedId}`];

  for (let index = 0; index < endpoints.length; index += 1) {
    const response = await fetch(endpoints[index], {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.ok) {
      return;
    }

    const message = await getErrorMessage(response);
    const shouldTryFallback =
      index < endpoints.length - 1 &&
      response.status === 404 &&
      /route not found/i.test(message);

    if (shouldTryFallback) {
      continue;
    }

    throw new Error(message);
  }

  throw new Error('Request failed (404)');
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
