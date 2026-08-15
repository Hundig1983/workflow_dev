# FamilyHub

A shared organiser for a household — calendar, tasks, shopping lists, and location, scoped to one
family. This repository currently contains the **walking skeleton**: registration, login, and an empty
family dashboard, proving one vertical seam through every layer.

| | |
|---|---|
| **Backend** | Fastify + TypeScript, PostgreSQL 17, opaque server-side sessions |
| **Client** | React Native + Expo + TypeScript |
| **Governance** | [`docs/architecture/constitution.md`](docs/architecture/constitution.md) — binding |
| **Specs** | [`openspec/`](openspec/) — OpenSpec changes and specs |

## Requirements

- **Node.js 20+** (developed on 24). `node --version`
- **No Docker required.** The backend depends on `embedded-postgres`, which ships real PostgreSQL 17
  binaries, so `npm run db:dev` gives you a local database with nothing else installed.

## Quick start

From a clean checkout:

```bash
# 1. Install dependencies (backend and client are separate packages)
npm --prefix backend install
npm --prefix client install

# 2. Start a local PostgreSQL (no Docker needed) — prints the DATABASE_URL to use
npm run db:dev

# 3. Point the backend at it and apply migrations
cp backend/.env.example backend/.env
#    then set DATABASE_URL in backend/.env to the URL printed by step 2
npm run backend:migrate

# 4. Run the API (http://127.0.0.1:3000)
npm run backend:dev

# 5. In a second terminal, run the client in a browser
cp client/.env.example client/.env
npm run client:web
```

Then sign up, log in, and you should land on your family's dashboard showing its empty state.

## Workspace scripts

Run from the repository root:

| Script | What it does |
|---|---|
| `npm run db:dev` | Start the local PostgreSQL cluster in `.pgdata/` (gitignored) |
| `npm run db:dev:stop` | Stop it |
| `npm run db:dev:status` | Report whether it is running |
| `npm run db:dev:reset` | Delete the cluster entirely — you must re-run migrations afterwards |
| `npm run backend:migrate` | Apply database migrations |
| `npm run backend:dev` | Run the API in watch mode |
| `npm run backend:test` | Run the backend test suite |
| `npm run client:web` | Run the Expo client in a browser |

## Backend

```bash
cd backend
npm run dev            # watch mode
npm run migrate        # apply migrations
npm run rollback       # roll the last migration back
npm test               # 51 tests — unit, integration, family isolation
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format         # prettier --write
```

Configuration lives in `backend/.env` (see `backend/.env.example`). No value in the example file is a
real credential.

The test suite starts its own throwaway PostgreSQL per run via `embedded-postgres`, so `npm test`
needs **no** running database and does not touch your development cluster.

## Client

```bash
cd client
npm run web            # run in a browser (the verified path on Linux/WSL)
npm run android        # requires an Android emulator or device
npm run ios            # requires macOS
npm run typecheck
npm run lint
```

`client/.env` sets `EXPO_PUBLIC_API_URL` (default `http://127.0.0.1:3000`). `EXPO_PUBLIC_*` values are
embedded in the shipped bundle and readable by anyone with the app — never put a secret there.

### A note on the web target

The session token is kept in `expo-secure-store` on iOS and Android. The web target has no equivalent
secure store, and `localStorage` is exactly the plain storage the constitution forbids, so **on web the
token is held in memory only** and is lost on reload. Web is a development and verification target
here, not a shipping one.

## Running with Docker Compose

`docker-compose.yml` describes a `postgres` + `api` stack:

```bash
cp backend/.env.example .env      # set POSTGRES_PASSWORD
docker compose up --build
```

> **Not yet verified.** No Docker runtime has been available in the development environment this was
> written in, so the compose path has never actually been executed. It is written from the same
> configuration the tested path uses, but treat it as unproven until someone runs it. Verifying it is
> task 8.1 of the walking-skeleton change, deliberately left open. The `npm run db:dev` path above **is**
> verified and is the recommended way to run locally.

## Project layout

```
backend/     Fastify API, migrations, tests
client/      Expo + React Native client
scripts/     devdb.mjs — local PostgreSQL without Docker
docs/        PRD, architecture, constitution, audits
openspec/    OpenSpec changes and specs
```

## Documentation

- [`docs/PRD/PRD.md`](docs/PRD/PRD.md) — product requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture and key decisions
- [`docs/architecture/constitution.md`](docs/architecture/constitution.md) — binding engineering rules
- [`openspec/changes/`](openspec/changes/) — in-flight changes
