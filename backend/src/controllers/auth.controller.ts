import type { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import {
  clearSessionCookie,
  getSessionUser,
  issueSessionCookie
} from '../middleware/auth.middleware.js';
import {
  authenticateStudentByNumber,
  changeUserPassword,
  getUserPasswordHash
} from '../services/student.service.js';
import { HttpError } from '../types/index.js';

export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const studentNumber =
      typeof req.body.studentNumber === 'string' ? req.body.studentNumber : '';
    const password =
      typeof req.body.password === 'string' ? req.body.password : '';

    if (!studentNumber.trim()) {
      throw new HttpError(400, 'Student number is required');
    }
    if (!password) {
      throw new HttpError(400, 'Password is required');
    }

    // Verify password against stored hash
    const storedHash = await getUserPasswordHash(studentNumber.trim());
    if (!storedHash) {
      throw new HttpError(401, 'Invalid student number or password');
    }
    const passwordValid = await bcrypt.compare(password, storedHash);
    if (!passwordValid) {
      throw new HttpError(401, 'Invalid student number or password');
    }

    if (studentNumber.trim().toLowerCase() === env.ADMIN_STUDENT_NUMBER.toLowerCase()) {
      issueSessionCookie(req, res, { role: 'admin', studentNumber: studentNumber.trim() });
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
    issueSessionCookie(req, res, { role: 'student', studentNumber: student.studentNumber });
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

export const logoutHandler: RequestHandler = (_req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ success: true, data: null, message: 'Signed out' });
};

export const changePasswordHandler: RequestHandler = async (req, res, next) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      throw new HttpError(401, 'Sign in required');
    }

    const currentPassword =
      typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword) {
      throw new HttpError(400, 'Current password is required');
    }
    if (!newPassword) {
      throw new HttpError(400, 'New password is required');
    }

    await changeUserPassword(sessionUser.studentNumber, currentPassword, newPassword);
    res.status(200).json({ success: true, data: null, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
};
