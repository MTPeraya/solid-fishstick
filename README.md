# Full-Stack App

## Stack
- Frontend: Next.js, TailwindCSS, TypeScript
- Backend: FastAPI, SQLModel, Alembic, PostgreSQL
- Auth: JWT

## Development
- Backend and database run with Docker
- Frontend runs with npm scripts

## Setup
- Copy `.env.example` and configure as needed
- Ensure Docker is running

## Backend
### Start services
```
docker compose up -d db
docker compose up --build backend
```

### Create migrations
```
docker compose exec backend alembic revision --autogenerate -m "init"
docker compose exec backend alembic upgrade head
```

API is available at `http://localhost:8000`.

## Frontend
### Install and run
```
cd frontend
npm install
npm run dev
```

App is available at `http://localhost:3010`.
