export interface Account {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
