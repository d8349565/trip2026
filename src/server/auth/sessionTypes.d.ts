import type { User } from '../../types';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    absoluteExpiresAt?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

export {};
