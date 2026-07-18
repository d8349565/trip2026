import session from 'express-session';
import type { DbEngine } from '../../dbEngine';

const FALLBACK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class SqliteSessionStore extends session.Store {
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(private readonly db: DbEngine) {
    super();
    this.cleanupTimer = setInterval(() => db.deleteExpiredSessions(), 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    try {
      const stored = this.db.getSession(sid);
      if (!stored || stored.expiresAt <= new Date().toISOString()) {
        if (stored) this.db.deleteSession(sid);
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(stored.data) as session.SessionData);
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, value: session.SessionData, callback?: (err?: unknown) => void): void {
    try {
      if (!value.userId) {
        callback?.();
        return;
      }
      const cookieExpiry = value.cookie.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + FALLBACK_MAX_AGE_MS;
      const absoluteExpiry = value.absoluteExpiresAt
        ? new Date(value.absoluteExpiresAt).getTime()
        : cookieExpiry;
      const expiresAt = new Date(Math.min(cookieExpiry, absoluteExpiry)).toISOString();
      this.db.setSession(sid, value.userId, JSON.stringify(value), expiresAt);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.db.deleteSession(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, value: session.SessionData, callback?: () => void): void {
    this.set(sid, value, () => callback?.());
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}
