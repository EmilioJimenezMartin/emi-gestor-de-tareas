# emi-gestor-de-tareas

Monorepo con:

- `apps/web`: Next.js (frontend)
- `apps/api`: Node.js (Fastify) + MongoDB (backend)

## Requisitos

- Node.js (probado con Node 24)
- Docker (opcional, para MongoDB y/o stack completo)

## Desarrollo (local)

1) Levanta MongoDB (elige una opcion):

Opcion A: MongoDB via Homebrew (local)

```bash
brew services start mongodb-community@7.0
```

Parar MongoDB (Homebrew):

```bash
brew services stop mongodb-community@7.0
```

Opcion B: MongoDB via Docker

```bash
docker compose up -d mongo
```

Parar MongoDB (Docker):

```bash
docker compose stop mongo
```

2) Variables de entorno:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

3) Instala dependencias:

```bash
npm install
```

4) Arranca front + back (recomendado):

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001/health`

Parar front + back: `Ctrl+C`

Arrancar solo el backend:

```bash
npm --workspace apps/api run dev
```

Arrancar solo el frontend:

```bash
npm --workspace apps/web run dev
```

Nota: en `apps/web` los scripts usan `--webpack` para evitar dependencias de Turbopack (p. ej. en entornos restringidos).

## Docker (stack completo)

```bash
docker compose up --build
```

Parar el stack:

```bash
docker compose down
```
