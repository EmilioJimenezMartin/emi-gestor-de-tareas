# emi-gestor-de-tareas

Monorepo con:

- `apps/web`: Next.js (frontend)
- `apps/api`: Node.js (Fastify) + MongoDB (backend)

## Requisitos

- Node.js (probado con Node 24)
- Docker (para MongoDB, y opcionalmente para API/Web)

## Desarrollo (local)

1) Levanta MongoDB:

```bash
cd fullstack-next-node-mongo
docker compose up -d mongo
```

2) Variables de entorno:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

3) Instala dependencias y arranca:

```bash
npm install
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001/health`

Nota: en `apps/web` los scripts usan `--webpack` para evitar dependencias de Turbopack (p. ej. en entornos restringidos).

## Docker (stack completo)

```bash
docker compose up --build
```

Levantar la base de datos localmente:
brew services start mongodb-community@7.0

Parar la base de datos:
brew services stop mongodb-community@7.0
