interface LoginResponse {
  success?: boolean;
  data?: {
    role?: 'student' | 'admin';
    studentNumber?: string;
    grade?: number;
    name?: string;
    surname?: string;
  };
  message?: string;
  error?: string;
}

const AUTH_API_BASE = '/api/auth';

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

export async function loginWithStudentNumber(studentNumber: string, password: string): Promise<
  | { role: 'admin'; studentNumber: string; name?: string; surname?: string }
  | { role: 'student'; studentNumber: string; grade: number; name?: string; surname?: string }
> {
  const response = await fetch(`${AUTH_API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ studentNumber, password }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as LoginResponse;
  const role = payload.data?.role;
  const resolvedStudentNumber = payload.data?.studentNumber;
  const resolvedGrade = Number(payload.data?.grade);
  const name = payload.data?.name;
  const surname = payload.data?.surname;

  if (!resolvedStudentNumber || (role !== 'student' && role !== 'admin')) {
    throw new Error('Unexpected login response');
  }

  if (role === 'admin') {
    return { role: 'admin', studentNumber: resolvedStudentNumber, name, surname };
  }

  if (!Number.isFinite(resolvedGrade)) {
    throw new Error('Unexpected login response');
  }
  return { role: 'student', studentNumber: resolvedStudentNumber, grade: resolvedGrade, name, surname };
}
