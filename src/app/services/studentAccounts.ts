import type { EnrollStudentPayload, StudentAccount, StudentAccountStatus } from '../types/studentAccounts';

const STUDENT_API_BASE = '/api/admin/students';

const toStatus = (value: unknown): StudentAccountStatus => {
  if (value === 'deactivated' || value === 'inactive') {
    return 'deactivated';
  }
  return 'active';
};

const mapStudentAccount = (raw: unknown, index: number): StudentAccount => {
  const item = (raw as Record<string, unknown>) ?? {};
  const studentNumberValue =
    item.studentNumber ??
    item.student_number ??
    item.studentNo ??
    item.student_no;

  return {
    id:
      String(item.id ?? item._id ?? item.studentId ?? studentNumberValue ?? `student-${index}`),
    name: String(item.name ?? item.firstName ?? ''),
    surname: String(item.surname ?? item.lastName ?? ''),
    studentNumber: String(studentNumberValue ?? ''),
    status: toStatus(item.status),
    grade: Number(item.grade ?? item.gradeLevel ?? item.grade_level ?? 10),
    createdAt: item.createdAt ? String(item.createdAt) : item.dateCreated ? String(item.dateCreated) : undefined,
  };
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
};

export async function fetchStudentAccounts(): Promise<StudentAccount[]> {
  const response = await fetch(STUDENT_API_BASE, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as unknown;
  let collection: unknown[] = [];

  if (Array.isArray(payload)) {
    collection = payload;
  } else if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    if (Array.isArray(container.data)) {
      collection = container.data;
    } else if (Array.isArray(container.students)) {
      collection = container.students;
    }
  }

  return collection.map((item, index) => mapStudentAccount(item, index));
}

export async function enrollStudent(payload: EnrollStudentPayload): Promise<StudentAccount> {
  const response = await fetch(`${STUDENT_API_BASE}/enroll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const raw = (await response.json()) as unknown;

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;

    if (record.studentNumber || record.student_number || record.studentNo || record.student_no) {
      return mapStudentAccount(
        {
          ...record,
          name: record.name ?? payload.name,
          surname: record.surname ?? payload.surname,
          status: record.status ?? 'active',
        },
        0
      );
    }

    if (record.data && typeof record.data === 'object') {
      return mapStudentAccount(
        {
          ...(record.data as Record<string, unknown>),
          name: (record.data as Record<string, unknown>).name ?? payload.name,
          surname: (record.data as Record<string, unknown>).surname ?? payload.surname,
          status: (record.data as Record<string, unknown>).status ?? 'active',
        },
        0
      );
    }
  }

  throw new Error('Unexpected enroll response: missing student number');
}

export async function deactivateStudentAccount(studentId: string): Promise<void> {
  const response = await fetch(`${STUDENT_API_BASE}/${encodeURIComponent(studentId)}/deactivate`, {
    method: 'PATCH',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function deleteStudentAccount(studentId: string): Promise<void> {
  const response = await fetch(`${STUDENT_API_BASE}/${encodeURIComponent(studentId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}
