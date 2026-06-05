# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start both frontend and backend (recommended)
npm run dev

# Start only backend
npm --workspace apps/api run dev

# Start only frontend
npm --workspace apps/web run dev
```

### Build
```bash
npm run build          # Builds both apps (api first, then web)
npm run lint           # Lint the web app
```

### API in production
```bash
npm run start:api      # Runs compiled JS from apps/api/dist/
```

### Local Image Server (Apple Silicon — FLUX.1-schnell)
```bash
# Arranca el servidor de generación de imágenes local (puerto 3002)
npm run start:image-server

# Primera vez: crea el venv Python e instala dependencias (~2min)
# Primera generación: descarga el modelo FLUX.1-schnell (~3.4GB desde HuggingFace)
# Generaciones siguientes: ~15-30s por imagen en M1/M2/M3
```

Requiere Python 3.10+. Solo funciona en Mac con Apple Silicon.
El backend lo usa automáticamente como primer proveedor cuando está activo.
Si está offline, cae al siguiente proveedor (Pollinations → fal.ai → HuggingFace).

### MongoDB
```bash
# Option A: Homebrew
brew services start mongodb-community@7.0

# Option B: Docker
docker compose up -d mongo
```

### Full Docker stack
```bash
docker compose up --build
docker compose down
```

## Environment Setup

Copy and fill env files before first run:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Key variables:
- `MONGODB_URI` — MongoDB connection string (default: `mongodb://localhost:27017/emi_gestor_de_tareas`)
- `CORS_ORIGIN` — allowed origin for API CORS (default: `http://localhost:3000`)
- `NEXT_PUBLIC_API_URL` — API base URL consumed by the web app (default: `http://localhost:3001`)
- `GOOGLE_API_KEY` / `HUGGINGFACE_API_KEY` / `LEONARDO_API_KEY` — optional AI provider keys; can be stored in MongoDB `Settings` collection instead

## Architecture

### Monorepo Structure
- `apps/web` — Next.js 16 frontend (React 19, Tailwind 4, Redux Toolkit + redux-persist)
- `apps/api` — Fastify 5 backend (TypeScript ESM, Mongoose 9, Socket.IO 4, Agenda job queue)

### API (`apps/api/src/`)

**Entry point:** `index.ts` registers all routes, connects MongoDB with a non-blocking retry loop, and initializes Agenda only after Mongo is available. The API stays up and serves requests even when MongoDB is down (routes return 503 individually via `ensureMongo()`).

**Route modules** (all registered in `index.ts`):
- `routes/tasks.ts` — CRUD for tasks and nested comment operations; seeds from `apps/web/src/data/tasks.json` on first empty DB load
- `routes/finance.ts` — Finance movements with Zod validation; emits Socket.IO events on mutations
- `routes/extractor.ts` — Web scraping jobs that fetch URLs/APIs, strip HTML, and call the AI layer
- `routes/ai.ts` — Image generation proxy supporting Google Gemini, Leonardo.AI, and Hugging Face, with Pollinations as final fallback
- `routes/settings.ts` — Key-value store in MongoDB for runtime config (LLM provider/model, API keys)
- `routes/items.ts` — Generic items collection

**AI config** (`lib/ai.ts`): LLM provider and model are read from the `Settings` MongoDB collection at runtime, falling back to env vars. Supports `google` (Gemini) and `huggingface` providers.

**Agenda** (`lib/agenda.ts`): Job scheduler backed by the same MongoDB. Jobs are defined in `jobs/index.ts`. Agenda start/stop events are forwarded to connected clients via Socket.IO.

**Task lookup** (`routes/tasks.ts → buildTaskQuery`): Tasks can be looked up by `id`, `slug`, or MongoDB `_id` interchangeably.

### Web (`apps/web/src/`)

**Data flow for tasks:**
1. Server Components call `lib/tasks.ts → getTasks()` / `getTaskBySlug()` which fetch from the API; fall back to static `data/tasks.json` if the API is unreachable
2. Mutations go through Next.js Server Actions in `app/actions/tasks.ts`, which call the API and call `revalidatePath()` on success; fall back to direct JSON file writes only as last resort

**Redux store** (`store/`): Two slices — `items` (persisted to localStorage) and `finance` (in-memory). The store is wrapped by `StoreProvider` in the root layout. Finance data is populated client-side from the API and kept in sync via Socket.IO events.

**Real-time:** Client-side Socket.IO connection is created with `lib/socket.ts → createApiSocket()`. Components subscribe to events (`db:status`, `finance:movement_*`, `items:created`, `agenda:*`, `extractor:*`) directly in client components or pages.

**Task Application system** (`config/task-apps-config.tsx`): Each task slug can map to a dedicated React component via `TASK_APPS_REGISTRY`. The page at `tareas/[slug]/aplicacion/` looks up the registry and renders the component, or shows a "coming soon" placeholder. New task apps are added by registering them in this file.

**Pages:**
- `/` — root page
- `/tareas` — task list
- `/tareas/[slug]` — task detail (Server Component, generates static params)
- `/tareas/[slug]/aplicacion` — task-specific application module
- `/dashboard` — dashboard
- `/finanzas` — finance module
- `/ajustes` — settings page (client component, connects Socket.IO for live DB status)

**Next.js note:** This project uses Next.js 16 with `--webpack` flag (not Turbopack) to avoid dependency issues. All `next dev` and `next build` calls must include `--webpack`.
