import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getMySqlPool } from '../config/mysql.js';
import type { Student, StudentGrade } from '../types/index.js';
import { HttpError } from '../types/index.js';

interface StudentRow extends RowDataPacket {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  grade_level: number;
  status: 'active' | 'deactivated';
  created_at: Date | string;
  updated_at: Date | string;
}

const toStudentGrade = (value: number): StudentGrade => {
  if (value === 10 || value === 11 || value === 12) {
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
  const year = new Date().getFullYear();
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `BNA${year}${randomPart}`;
};

const findStudentById = async (studentId: string): Promise<Student | null> => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<StudentRow[]>(
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
      WHERE u.id = ? AND u.role = 'student'
      LIMIT 1
    `,
    [studentId]
  );

  if (!rows[0]) {
    return null;
  }

  return toStudent(rows[0]);
};

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );

const assertStudentGrade = (grade: number): StudentGrade => {
  if (grade !== 10 && grade !== 11 && grade !== 12) {
    throw new HttpError(400, 'Grade must be 10, 11, or 12');
  }
  return grade;
};

export const enrollStudent = async (
  name: string,
  surname: string,
  grade: number
): Promise<Student> => {
  const cleanName = name.trim();
  const cleanSurname = surname.trim();
  const cleanGrade = assertStudentGrade(grade);

  if (!cleanName || !cleanSurname) {
    throw new HttpError(400, 'Name and surname are required');
  }

  const pool = getMySqlPool();
  const connection = await pool.getConnection();
  const studentId = randomUUID();
  let inserted = false;

  try {
    // Retry on generated student number collisions.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const studentNumber = buildStudentNumber();
      try {
        await connection.beginTransaction();
        await connection.query<ResultSetHeader>(
          `
            INSERT INTO users (id, role, student_number, grade_level, status, created_at, updated_at)
            VALUES (?, 'student', ?, ?, 'active', NOW(), NOW())
          `,
          [studentId, studentNumber, cleanGrade]
        );
        await connection.query<ResultSetHeader>(
          `
            INSERT INTO students (user_id, first_name, last_name, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
          `,
          [studentId, cleanName, cleanSurname]
        );
        await connection.commit();
        inserted = true;
        break;
      } catch (error) {
        await connection.rollback();
        if (isDuplicateKeyError(error)) {
          continue;
        }
        throw error;
      }
    }
  } finally {
    connection.release();
  }

  if (!inserted) {
    throw new HttpError(500, 'Failed to generate a unique student number');
  }

  const createdStudent = await findStudentById(studentId);
  if (!createdStudent) {
    throw new HttpError(500, 'Failed to create student account');
  }

  return createdStudent;
};

export const listStudents = async (): Promise<Student[]> => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<StudentRow[]>(
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

  const pool = getMySqlPool();
  const [rows] = await pool.query<StudentRow[]>(
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
        AND u.status = 'active'
        AND LOWER(u.student_number) = LOWER(?)
      LIMIT 1
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

  const pool = getMySqlPool();
  const [updateResult] = await pool.query<ResultSetHeader>(
    `
      UPDATE users
      SET status = 'deactivated', updated_at = NOW()
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

  const pool = getMySqlPool();
  const [result] = await pool.query<ResultSetHeader>(
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
