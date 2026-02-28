import type { RequestHandler } from 'express';
import {
  deactivateStudent,
  enrollStudent,
  listStudents,
  removeStudent
} from '../services/student.service.js';
import { HttpError } from '../types/index.js';

export const enrollStudentHandler: RequestHandler = async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name : '';
    const surname = typeof req.body.surname === 'string' ? req.body.surname : '';
    const gradeValue = req.body.grade;
    const grade =
      typeof gradeValue === 'number'
        ? gradeValue
        : typeof gradeValue === 'string'
          ? Number(gradeValue)
          : NaN;

    if (!name.trim() || !surname.trim()) {
      throw new HttpError(400, 'Both name and surname are required');
    }

    if (!Number.isFinite(grade)) {
      throw new HttpError(400, 'Grade is required');
    }

    const student = await enrollStudent(name, surname, grade);
    res.status(201).json({
      success: true,
      data: student,
      message: 'Student account created successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const listStudentsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const students = await listStudents();
    res.status(200).json({
      success: true,
      data: students
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateStudentHandler: RequestHandler = async (req, res, next) => {
  try {
    const studentId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!studentId.trim()) {
      throw new HttpError(400, 'Student id is required');
    }

    const student = await deactivateStudent(studentId);
    res.status(200).json({
      success: true,
      data: student,
      message: 'Student account deactivated'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStudentHandler: RequestHandler = async (req, res, next) => {
  try {
    const studentId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!studentId.trim()) {
      throw new HttpError(400, 'Student id is required');
    }

    await removeStudent(studentId);
    res.status(200).json({
      success: true,
      data: null,
      message: 'Student account deleted'
    });
  } catch (error) {
    next(error);
  }
};
