export interface Session {
  token: string;
  expiresAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface SignupInput extends Credentials {
  familyName?: string;
}

/** A validation failure bound to the input that caused it (7.2). */
export interface FieldError {
  field: string;
  message: string;
}
