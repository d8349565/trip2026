import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import argon2 from 'argon2';
import { z } from 'zod';
import { hashPassword, type DbEngine } from '../../dbEngine';
import { config } from '../config';
import { SqliteSessionStore } from './sqliteSessionStore';

export const SESSION_COOKIE_NAME = 'travel.sid';
const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

const registerSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N}_.-]+$/u),
  password: z.string().min(10).max(128),
  inviteCode: z.string().trim().min(1).max(64),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(10).max(128),
});

function apiError(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details === undefined ? {} : { details }) } });
}

async function verifyPassword(password: string, passwordHash: string, algorithm: string): Promise<boolean> {
  if (algorithm === 'argon2id') return argon2.verify(passwordHash, password);
  if (algorithm === 'legacy_sha256') {
    const candidate = Buffer.from(hashPassword(password), 'hex');
    const expected = Buffer.from(passwordHash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }
  return false;
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
}

async function establishSession(req: Request, userId: string) {
  await regenerateSession(req);
  req.session.userId = userId;
  req.session.absoluteExpiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MS).toISOString();
  await saveSession(req);
}

export function createSessionMiddleware(db: DbEngine) {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: config.sessionSecret,
    store: new SqliteSessionStore(db),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.sessionCookieSecure,
      maxAge: SESSION_IDLE_MS,
      path: '/',
    },
  });
}

export function originGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const allowedOrigin = config.appOrigin || `${req.protocol}://${req.get('host')}`;
  if (origin !== allowedOrigin) {
    apiError(res, 403, 'ORIGIN_REJECTED', 'Request origin is not allowed');
    return;
  }
  next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => apiError(res, 429, 'LOGIN_RATE_LIMITED', 'Too many login attempts; try again later'),
});

export function createAuthRouter(db: DbEngine): Router {
  const router = Router();

  router.post('/login', loginLimiter, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return apiError(res, 400, 'VALIDATION_ERROR', 'Invalid login request', parsed.error.flatten());
      const credential = db.getUserCredential(parsed.data.username);
      if (!credential || !credential.user.is_active || !await verifyPassword(
        parsed.data.password,
        credential.passwordHash,
        credential.algorithm,
      )) {
        return apiError(res, 401, 'INVALID_CREDENTIALS', 'Username or password is incorrect');
      }

      if (credential.algorithm === 'legacy_sha256') {
        db.setPassword(credential.user.id, await argon2.hash(parsed.data.password, { type: argon2.argon2id }));
      }
      await establishSession(req, credential.user.id);
      res.json({ user: credential.user, password_upgraded: credential.algorithm === 'legacy_sha256' });
    } catch (error) {
      console.error('Login failed', error);
      apiError(res, 500, 'LOGIN_FAILED', 'Unable to complete login');
    }
  });

  router.post('/register-by-invite', loginLimiter, async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return apiError(res, 400, 'VALIDATION_ERROR', 'Invalid registration request', parsed.error.flatten());
      const user = db.registerByInvite({
        id: `u_${crypto.randomUUID()}`,
        username: parsed.data.username,
        passwordHash: await argon2.hash(parsed.data.password, { type: argon2.argon2id }),
        inviteCode: parsed.data.inviteCode,
        createdAt: new Date().toISOString(),
      });
      await establishSession(req, user.id);
      res.status(201).json({ user });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVITE_INVALID') {
        return apiError(res, 400, 'INVITE_INVALID', 'Invite code is invalid, expired, or exhausted');
      }
      if (error instanceof Error && error.message === 'USERNAME_EXISTS') {
        return apiError(res, 409, 'USERNAME_EXISTS', 'Username already exists');
      }
      console.error('Registration failed', error);
      apiError(res, 500, 'REGISTRATION_FAILED', 'Unable to complete registration');
    }
  });

  router.post('/logout', (req, res) => {
    req.session.destroy((error) => {
      if (error) return apiError(res, 500, 'LOGOUT_FAILED', 'Unable to complete logout');
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.status(204).end();
    });
  });

  router.post('/change-password', async (req, res) => {
    try {
      if (!req.session.userId) return apiError(res, 401, 'AUTH_REQUIRED', 'Login is required');
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) return apiError(res, 400, 'VALIDATION_ERROR', 'Invalid password request', parsed.error.flatten());
      const user = db.getUserById(req.session.userId);
      const credential = user ? db.getUserCredential(user.username) : undefined;
      if (!credential || !await verifyPassword(parsed.data.currentPassword, credential.passwordHash, credential.algorithm)) {
        return apiError(res, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
      }
      db.setPassword(user!.id, await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id }));
      db.deleteUserSessions(user!.id);
      await establishSession(req, user!.id);
      res.status(204).end();
    } catch (error) {
      console.error('Password change failed', error);
      apiError(res, 500, 'PASSWORD_CHANGE_FAILED', 'Unable to change password');
    }
  });

  return router;
}

export function currentUser(db: DbEngine) {
  return (req: Request, res: Response) => {
    const user = req.session.userId ? db.getUserById(req.session.userId) : undefined;
    if (!user || !user.is_active) return apiError(res, 401, 'AUTH_REQUIRED', 'Login is required');
    res.json({ user });
  };
}

export function requireAuth(db: DbEngine) {
  return (req: Request, res: Response, next: NextFunction) => {
    const absoluteExpiry = req.session.absoluteExpiresAt;
    if (!req.session.userId || !absoluteExpiry || absoluteExpiry <= new Date().toISOString()) {
      return apiError(res, 401, 'AUTH_REQUIRED', 'Login is required');
    }
    const user = db.getUserById(req.session.userId);
    if (!user || !user.is_active) {
      req.session.destroy(() => undefined);
      return apiError(res, 401, 'AUTH_REQUIRED', 'Login is required');
    }
    req.currentUser = user;
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.currentUser?.role !== 'admin') return apiError(res, 403, 'ADMIN_REQUIRED', 'Administrator access is required');
  next();
}
