import 'dotenv/config';
import path from 'node:path';

export type AppEnvironment = 'development' | 'test' | 'production';

function readEnvironment(value: string | undefined): AppEnvironment {
  const environment = value ?? 'development';
  if (environment === 'development' || environment === 'test' || environment === 'production') {
    return environment;
  }
  throw new Error(`NODE_ENV must be development, test, or production; received "${environment}"`);
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`APP_PORT must be an integer between 0 and 65535; received "${value}"`);
  }
  return port;
}

function readSessionSecret(value: string | undefined, environment: AppEnvironment): string {
  if (value && value.length >= 32) return value;
  if (environment === 'production') {
    throw new Error('SESSION_SECRET must contain at least 32 characters in production');
  }
  return 'development-only-session-secret-change-me';
}

const environment = readEnvironment(process.env.NODE_ENV);
const dataPath = path.resolve(process.cwd(), process.env.APP_DATA_DIR?.trim() || 'data');

export const config = Object.freeze({
  environment,
  isProduction: environment === 'production',
  host: process.env.APP_HOST?.trim() || '127.0.0.1',
  port: readPort(process.env.APP_PORT),
  clientDistPath: path.resolve(process.cwd(), 'dist', 'client'),
  uploadsPath: path.resolve(process.cwd(), process.env.APP_UPLOADS_DIR?.trim() || 'uploads'),
  dataPath,
  databasePath: path.join(dataPath, 'travel-footprint.sqlite'),
  migrationsPath: path.resolve(process.cwd(), 'migrations'),
  legacyDatabasePath: path.resolve(process.cwd(), 'db.json'),
  sessionSecret: readSessionSecret(process.env.SESSION_SECRET, environment),
  sessionCookieSecure: process.env.SESSION_COOKIE_SECURE === 'true',
  appOrigin: process.env.APP_ORIGIN?.trim(),
  amapWebKey: process.env.AMAP_WEB_KEY?.trim(),
  amapWebServiceKey: process.env.AMAP_WEB_SERVICE_KEY?.trim(),
  amapSecurityJsCode: process.env.AMAP_SECURITY_JSCODE?.trim(),
  tlsCertPath: process.env.APP_TLS_CERT?.trim() || undefined,
  tlsKeyPath: process.env.APP_TLS_KEY?.trim() || undefined,
});
