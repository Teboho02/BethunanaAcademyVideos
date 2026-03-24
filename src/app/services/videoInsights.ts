export interface VideoViewer {
  studentNumber: string;
  name: string | null;
  surname: string | null;
  totalWatchedSeconds: number;
  lastPositionSeconds: number;
  updatedAt: string;
}

export interface VideoAnalytics {
  videoId: string;
  viewerCount: number;
  totalWatchedSeconds: number;
  averageWatchSeconds: number;
  viewers: VideoViewer[];
}

export interface VideoProgress {
  videoId: string;
  studentNumber: string;
  lastPositionSeconds: number;
  totalWatchedSeconds: number;
  updatedAt: string;
}

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

export async function saveVideoProgress(
  videoId: string,
  studentNumber: string,
  positionSeconds: number,
  watchedSecondsDelta: number
): Promise<void> {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ studentNumber, positionSeconds, watchedSecondsDelta }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function getVideoProgress(videoId: string, studentNumber: string): Promise<VideoProgress | null> {
  const response = await fetch(
    `/api/videos/${encodeURIComponent(videoId)}/progress?studentNumber=${encodeURIComponent(studentNumber)}`,
    { method: 'GET', credentials: 'include' }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const payload = (await response.json()) as { data?: VideoProgress | null };
  return payload.data ?? null;
}

export async function listVideoAnalytics(): Promise<VideoAnalytics[]> {
  const response = await fetch('/api/videos/analytics', { method: 'GET', credentials: 'include' });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const payload = (await response.json()) as { data?: VideoAnalytics[] };
  return Array.isArray(payload.data) ? payload.data : [];
}
