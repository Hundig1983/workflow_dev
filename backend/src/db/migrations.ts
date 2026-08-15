export interface Migration {
  id: string;
  up: string;
  down: string;
}

/**
 * Ordered, reversible migrations. Every `up` must have a `down` that returns the
 * schema to its prior state — the RISKY-tier rollback requirement for this change.
 */
export const migrations: readonly Migration[] = [
  {
    id: '001_initial',
    up: `
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text        NOT NULL UNIQUE,
        password_hash text        NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_email_is_normalized CHECK (email = lower(email)),
        CONSTRAINT users_email_not_blank     CHECK (length(trim(email)) > 0)
      );

      CREATE TABLE families (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name       text        NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT families_name_not_blank CHECK (length(trim(name)) > 0)
      );

      CREATE TYPE family_role AS ENUM ('parent', 'child');

      CREATE TABLE family_members (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id  uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        user_id    uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        role       family_role NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT family_members_unique_pair UNIQUE (family_id, user_id)
      );

      CREATE INDEX family_members_user_id_idx ON family_members (user_id);

      CREATE TABLE sessions (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text        NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX sessions_user_id_idx ON sessions (user_id);
    `,
    down: `
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS family_members;
      DROP TYPE  IF EXISTS family_role;
      DROP TABLE IF EXISTS families;
      DROP TABLE IF EXISTS users;
    `,
  },
];
