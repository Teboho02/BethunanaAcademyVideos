export type QuestionGenerationState = 'none' | 'queued' | 'processing' | 'completed' | 'failed';

export interface QuizQuestion {
  id: number;
  position: number;
  question: string;
  options: string[];
  difficulty: string;
}

export interface QuestionGenerationStatus {
  state: QuestionGenerationState;
  questionCount: number;
  lastError: string | null;
}

export interface QuizPayload {
  questions: QuizQuestion[];
  generation: QuestionGenerationStatus;
}

export interface GradedAnswer {
  questionId: number;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface AttemptResult {
  total: number;
  correct: number;
  answers: GradedAnswer[];
}

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

export async function getVideoQuestions(videoId: string): Promise<QuizPayload> {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/questions`, {
    method: 'GET',
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const payload = (await response.json()) as { data?: QuizPayload };
  return (
    payload.data ?? { questions: [], generation: { state: 'none', questionCount: 0, lastError: null } }
  );
}

export async function submitQuizAttempt(
  videoId: string,
  answers: Record<number, number>
): Promise<AttemptResult> {
  const response = await fetch(
    `/api/videos/${encodeURIComponent(videoId)}/questions/attempt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ answers })
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const payload = (await response.json()) as { data: AttemptResult };
  return payload.data;
}

export async function generateVideoQuestions(videoId: string): Promise<boolean> {
  const response = await fetch(
    `/api/videos/${encodeURIComponent(videoId)}/questions/generate`,
    { method: 'POST', credentials: 'include' }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const payload = (await response.json()) as { data?: { enqueued?: boolean } };
  return Boolean(payload.data?.enqueued);
}
