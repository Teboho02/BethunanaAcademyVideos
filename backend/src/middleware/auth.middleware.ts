import { randomBytes } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../types/index.js';

const SESSION_COOKIE = 'ba_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

// Without a configured JWT_SECRET, fall back to a per-process secret so auth
// still works — sessions just don't survive a server restart.
const jwtSecret = env.JWT_SECRET || randomBytes(32).toString('hex');
if (!env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET is not set; using a random per-process secret. Sessions will not survive restarts.'
  );
}

export interface SessionUser {
  role: 'admin' | 'student';
  studentNumber: string;
}

const parseCookies = (req: Request): Record<string, string> => {
  const header = req.headers.cookie;
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
};

const isSecureRequest = (req: Request): boolean =>
  req.secure || req.headers['x-forwarded-proto'] === 'https';

export const issueSessionCookie = (req: Request, res: Response, user: SessionUser): void => {
  const token = jwt.sign(user, jwtSecret, { expiresIn: SESSION_TTL_SECONDS });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/'
  });
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
};

export const getSessionUser = (req: Request): SessionUser | null => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload !== 'object' || payload === null) return null;
    const role = (payload as Record<string, unknown>).role;
    const studentNumber = (payload as Record<string, unknown>).studentNumber;
    if ((role !== 'admin' && role !== 'student') || typeof studentNumber !== 'string') {
      return null;
    }
    return { role, studentNumber };
  } catch {
    return null;
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const user = getSessionUser(req);
  if (!user) {
    next(new HttpError(401, 'Sign in required'));
    return;
  }
  if (user.role !== 'admin') {
    next(new HttpError(403, 'Admin access required'));
    return;
  }
  next();
};

const hasValidSyncSecret = (req: Request): boolean => {
  const provided = req.headers['x-sync-secret'];
  return Boolean(
    env.ENROLL_SYNC_SECRET &&
      typeof provided === 'string' &&
      provided === env.ENROLL_SYNC_SECRET
  );
};

/**
 * For the enroll endpoint: allows a signed-in admin, or a trusted
 * server-to-server call from the exams platform carrying the shared
 * X-Sync-Secret header (cookies don't work between servers).
 */
export const requireAdminOrSyncSecret: RequestHandler = (req, res, next) => {
  if (hasValidSyncSecret(req)) {
    next();
    return;
  }
  requireAdmin(req, res, next);
};
