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
  {
    id: '002_shopping_lists',
    up: `
      CREATE TABLE shopping_lists (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        name       text NOT NULL,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT shopping_lists_name_not_blank CHECK (length(trim(name)) > 0),
        CONSTRAINT shopping_lists_name_max CHECK (length(name) <= 120)
      );

      CREATE INDEX shopping_lists_family_id_idx ON shopping_lists (family_id);

      CREATE TABLE shopping_items (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        list_id     uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
        name        text NOT NULL,
        quantity    text,
        note        text,
        checked_at  timestamptz,
        checked_by  uuid REFERENCES users(id) ON DELETE SET NULL,
        archived_at timestamptz,
        created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT shopping_items_name_not_blank CHECK (length(trim(name)) > 0),
        CONSTRAINT shopping_items_archived_implies_checked
          CHECK (archived_at IS NULL OR checked_at IS NOT NULL)
      );

      CREATE INDEX shopping_items_active_by_list_idx
        ON shopping_items (list_id) WHERE archived_at IS NULL;
    `,
    down: `
      DROP TABLE IF EXISTS shopping_items;
      DROP TABLE IF EXISTS shopping_lists;
    `,
  },
];
