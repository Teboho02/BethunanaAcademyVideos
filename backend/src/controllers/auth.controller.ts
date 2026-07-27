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
import { endSession, startSession } from '../services/session.service.js';
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
      // Start a fresh single active session, superseding any other device.
      const sid = await startSession(studentNumber.trim());
      const token = issueSessionCookie(req, res, { role: 'admin', studentNumber: studentNumber.trim(), sid });
      res.status(200).json({
        success: true,
        data: {
          role: 'admin',
          studentNumber: studentNumber.trim(),
          // Returned so the mobile app (which cannot use cookies) can send it
          // as a Bearer token.
          token
        }
      });
      return;
    }

    const student = await authenticateStudentByNumber(studentNumber);
    const sid = await startSession(student.studentNumber);
    const token = issueSessionCookie(req, res, { role: 'student', studentNumber: student.studentNumber, sid });
    res.status(200).json({
      success: true,
      data: {
        role: 'student',
        studentNumber: student.studentNumber,
        grade: student.grade,
        name: student.name,
        surname: student.surname,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logoutHandler: RequestHandler = async (req, res) => {
  // Best-effort: clear the account's active session so no lingering token works.
  const user = getSessionUser(req);
  if (user) {
    try { await endSession(user.studentNumber); } catch { /* ignore */ }
  }
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
