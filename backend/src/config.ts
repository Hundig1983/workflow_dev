import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function intOr(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${name} must be an integer.`);
  return parsed;
}

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
  sessionTtlHours: number;
  logLevel: string;
}

export function loadConfig(): Config {
  return {
    databaseUrl: required('DATABASE_URL'),
    port: intOr('PORT', 3000),
    host: process.env['HOST'] ?? '0.0.0.0',
    sessionTtlHours: intOr('SESSION_TTL_HOURS', 720),
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
  };
}
