import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { authenticateStudentByNumber } from '../services/student.service.js';
import { HttpError } from '../types/index.js';

export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const studentNumber =
      typeof req.body.studentNumber === 'string' ? req.body.studentNumber : '';

    if (!studentNumber.trim()) {
      throw new HttpError(400, 'Student number is required');
    }

    if (studentNumber.trim().toLowerCase() === env.ADMIN_STUDENT_NUMBER.toLowerCase()) {
      res.status(200).json({
        success: true,
        data: {
          role: 'admin',
          studentNumber: studentNumber.trim()
        }
      });
      return;
    }

    const student = await authenticateStudentByNumber(studentNumber);
    res.status(200).json({
      success: true,
      data: {
        role: 'student',
        studentNumber: student.studentNumber,
        grade: student.grade,
        name: student.name,
        surname: student.surname
      }
    });
  } catch (error) {
    next(error);
  }
};
