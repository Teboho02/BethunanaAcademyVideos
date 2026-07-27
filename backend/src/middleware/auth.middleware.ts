import { randomBytes } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { isSessionActive } from '../services/session.service.js';
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
  // Active-session id (single-device enforcement). Optional so pre-existing
  // cookies issued before this feature keep working until they expire.
  sid?: string;
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

// Signs a session token, sets it as the httpOnly cookie (web) and returns it so
// the caller can also hand it back in the response body (mobile, which cannot
// use cookies, sends it as a Bearer token).
export const issueSessionCookie = (req: Request, res: Response, user: SessionUser): string => {
  const token = jwt.sign(user, jwtSecret, { expiresIn: SESSION_TTL_SECONDS });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/'
  });
  return token;
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
};

const bearerToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
};

// Accepts the session token from the httpOnly cookie (web) or an Authorization
// Bearer header (mobile).
export const getSessionUser = (req: Request): SessionUser | null => {
  const token = parseCookies(req)[SESSION_COOKIE] ?? bearerToken(req);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload !== 'object' || payload === null) return null;
    const role = (payload as Record<string, unknown>).role;
    const studentNumber = (payload as Record<string, unknown>).studentNumber;
    const sid = (payload as Record<string, unknown>).sid;
    if ((role !== 'admin' && role !== 'student') || typeof studentNumber !== 'string') {
      return null;
    }
    return { role, studentNumber, sid: typeof sid === 'string' ? sid : undefined };
  } catch {
    return null;
  }
};

// Rejects a token whose sid is no longer the account's active session (logged in
// on another device). Tokens without a sid (issued before this feature) pass.
const assertActiveSession = async (user: SessionUser, res: Response): Promise<boolean> => {
  if (!user.sid) return true;
  if (await isSessionActive(user.studentNumber, user.sid)) return true;
  res.setHeader('X-Session-Revoked', 'replaced');
  return false;
};

// Requires any signed-in user (student or admin) with a still-current session.
export const requireSession: RequestHandler = async (req, res, next) => {
  const user = getSessionUser(req);
  if (!user) {
    next(new HttpError(401, 'Sign in required'));
    return;
  }
  if (!(await assertActiveSession(user, res))) {
    next(new HttpError(401, 'Signed in on another device'));
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = getSessionUser(req);
  if (!user) {
    next(new HttpError(401, 'Sign in required'));
    return;
  }
  if (user.role !== 'admin') {
    next(new HttpError(403, 'Admin access required'));
    return;
  }
  if (!(await assertActiveSession(user, res))) {
    next(new HttpError(401, 'Signed in on another device'));
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
