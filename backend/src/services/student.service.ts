import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { execute, isDuplicateKeyError, queryRows, withTransaction } from '../config/db.js';
import type { Student, StudentGrade } from '../types/index.js';
import { HttpError } from '../types/index.js';

const DEFAULT_PASSWORD = 'Password';
const BCRYPT_ROUNDS = 10;

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  grade_level: number;
  status: 'active' | 'deactivated';
  created_at: Date | string;
  updated_at: Date | string;
}

const VALID_GRADES: readonly StudentGrade[] = [8, 9, 10, 11, 12];

const isStudentGrade = (value: number): value is StudentGrade =>
  (VALID_GRADES as readonly number[]).includes(value);

const toStudentGrade = (value: number): StudentGrade => {
  if (isStudentGrade(value)) {
    return value;
  }
  throw new HttpError(500, 'Invalid grade in database');
};

const toStudent = (row: StudentRow): Student => ({
  id: row.id,
  name: row.first_name,
  surname: row.last_name,
  studentNumber: row.student_number,
  grade: toStudentGrade(Number(row.grade_level)),
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

const buildStudentNumber = (): string => {
  const prefix = Math.random() < 0.5 ? 2 : 3;
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${suffix}`;
};

interface PasswordRow {
  password_hash: string;
}

export const getUserPasswordHash = async (
  studentNumber: string
): Promise<string | null> => {
  const rows = await queryRows<PasswordRow>(
    `SELECT TOP 1 password_hash FROM users WHERE LOWER(student_number) = LOWER(?) AND status = 'active'`,
    [studentNumber]
  );
  return rows[0]?.password_hash ?? null;
};

const findStudentById = async (studentId: string): Promise<Student | null> => {
  const rows = await queryRows<StudentRow>(
    `
      SELECT TOP 1
        u.id,
        s.first_name,
        s.last_name,
        u.student_number,
        u.grade_level,
        u.status,
        u.created_at,
        u.updated_at
      FROM users u
      INNER JOIN students s ON s.user_id = u.id
      WHERE u.id = ? AND u.role = 'student'
    `,
    [studentId]
  );

  if (!rows[0]) {
    return null;
  }

  return toStudent(rows[0]);
};

const assertStudentGrade = (grade: number): StudentGrade => {
  if (!isStudentGrade(grade)) {
    throw new HttpError(400, `Grade must be one of: ${VALID_GRADES.join(', ')}`);
  }
  return grade;
};

const syncStudentToExternalSystem = async (student: Student): Promise<void> => {
  let response: Response;

  try {
    response = await fetch('https://baonlineexaminations.com/api/students/from-existing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: student.name,
        lastName: student.surname,
        grade: student.grade,
        studentNumber: student.studentNumber,
      }),
    });
  } catch {
    throw new HttpError(502, 'Could not reach external system: baonlineexaminations.com');
  }

  if (!response.ok) {
    throw new HttpError(502, `Failed to sync student to external system: ${response.statusText}`);
  }
};

export const enrollStudent = async (
  name: string,
  surname: string,
  grade: number,
  options: { skipExternalSync?: boolean } = {}
): Promise<Student> => {
  const cleanName = name.trim();
  const cleanSurname = surname.trim();
  const cleanGrade = assertStudentGrade(grade);

  if (!cleanName || !cleanSurname) {
    throw new HttpError(400, 'Name and surname are required');
  }

  // Loop guard: the exams platform and this app sync enrollments to each
  // other, and a bug on either side can bounce the same student back and
  // forth forever (this once created 554 accounts in 4 minutes). Refuse
  // to create the same name+grade twice in quick succession.
  const recentDuplicate = await queryRows<{ id: string }>(
    `SELECT TOP 1 u.id
     FROM users u
     INNER JOIN students s ON s.user_id = u.id
     WHERE u.role = 'student'
       AND u.grade_level = ?
       AND s.first_name = ?
       AND s.last_name = ?
       AND u.created_at > DATEADD(SECOND, -120, GETDATE())`,
    [cleanGrade, cleanName, cleanSurname]
  );
  if (recentDuplicate[0]) {
    throw new HttpError(
      409,
      'A student with this name and grade was enrolled moments ago. Wait two minutes if you really need a second identical account.'
    );
  }

  const studentId = randomUUID();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  let inserted = false;

  // Retry on generated student number collisions.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const studentNumber = buildStudentNumber();
    try {
      await withTransaction(async (tx) => {
        await tx.execute(
          `
            INSERT INTO users (id, role, student_number, password_hash, grade_level, status, created_at, updated_at)
            VALUES (?, 'student', ?, ?, ?, 'active', GETDATE(), GETDATE())
          `,
          [studentId, studentNumber, passwordHash, cleanGrade]
        );
        await tx.execute(
          `
            INSERT INTO students (user_id, first_name, last_name, created_at, updated_at)
            VALUES (?, ?, ?, GETDATE(), GETDATE())
          `,
          [studentId, cleanName, cleanSurname]
        );
      });
      inserted = true;
      break;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        continue;
      }
      throw error;
    }
  }

  if (!inserted) {
    throw new HttpError(500, 'Failed to generate a unique student number');
  }

  const createdStudent = await findStudentById(studentId);
  if (!createdStudent) {
    throw new HttpError(500, 'Failed to create student account');
  }

  // Enrollments that originate from the exams platform must not be synced
  // back to it — that is how the enrollment ping-pong loop starts.
  if (!options.skipExternalSync) {
    await syncStudentToExternalSystem(createdStudent);
  }

  return createdStudent;
};

export const listStudents = async (): Promise<Student[]> => {
  const rows = await queryRows<StudentRow>(
    `
      SELECT
        u.id,
        s.first_name,
        s.last_name,
        u.student_number,
        u.grade_level,
        u.status,
        u.created_at,
        u.updated_at
      FROM users u
      INNER JOIN students s ON s.user_id = u.id
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `
  );

  return rows.map(toStudent);
};

export const authenticateStudentByNumber = async (
  studentNumber: string
): Promise<Student> => {
  const normalizedStudentNumber = studentNumber.trim();
  if (!normalizedStudentNumber) {
    throw new HttpError(400, 'Student number is required');
  }

  const rows = await queryRows<StudentRow>(
    `
      SELECT TOP 1
        u.id,
        s.first_name,
        s.last_name,
        u.student_number,
        u.grade_level,
        u.status,
        u.created_at,
        u.updated_at
      FROM users u
      INNER JOIN students s ON s.user_id = u.id
      WHERE u.role = 'student'
        AND u.status = 'active'
        AND LOWER(u.student_number) = LOWER(?)
    `,
    [normalizedStudentNumber]
  );

  const matchedStudent = rows[0];
  if (!matchedStudent) {
    throw new HttpError(401, 'Invalid student number');
  }

  return toStudent(matchedStudent);
};

export const deactivateStudent = async (studentId: string): Promise<Student> => {
  if (!studentId.trim()) {
    throw new HttpError(400, 'Student id is required');
  }

  const updateResult = await execute(
    `
      UPDATE users
      SET status = 'deactivated', updated_at = GETDATE()
      WHERE id = ? AND role = 'student'
    `,
    [studentId]
  );

  if (updateResult.affectedRows === 0) {
    throw new HttpError(404, 'Student not found');
  }

  const student = await findStudentById(studentId);
  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  return student;
};

export const removeStudent = async (studentId: string): Promise<void> => {
  if (!studentId.trim()) {
    throw new HttpError(400, 'Student id is required');
  }

  const result = await execute(
    `
      DELETE FROM users
      WHERE id = ? AND role = 'student'
    `,
    [studentId]
  );

  if (result.affectedRows === 0) {
    throw new HttpError(404, 'Student not found');
  }
};
