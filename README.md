# 🏪 Minimart POS & Inventory Management System 

## Overview

This is a full-stack Point-of-Sale (POS) and inventory management application designed for minimarts and small retail businesses. It provides two main user roles: a **Cashier** interface for processing sales and a **Manager** dashboard for business oversight.

***

## Tech Stack

| Component | Technology | Key Libraries/Frameworks |
| :--- | :--- | :--- |
| **Frontend** | **Next.js** (React) | TypeScript, TailwindCSS |
| **Backend** | **FastAPI** (Python) | SQLModel, Pydantic, Passlib, PyJWT |
| **Database** | **PostgreSQL** | Dockerized, managed with Alembic migrations |
| **Authentication** | **JWT** | Email/Username sign-in, Role-based access control |

***

## Local Development Setup

This project uses **Docker Compose** to run the database and backend services.

### Prerequisites
* **Docker** (with Docker Compose)
* **Node.js** and **npm** (for the frontend)

### 1. Configuration

Copy the example environment file to `.env` in the project root. This file holds configuration for the database connection and the JWT secret key.

```bash
cp .env.example .env
````

### 2\. Start Services

Start the database and backend in detached mode. The backend container runs database migrations automatically on startup.

```bash
docker compose up --build
```

### 3\. Seed Initial Data (Optional)

Run the seeding script to populate the database with realistic test data.

#### Seed everything at once (recommended)
```bash
docker compose exec backend python -m app.seed --all
```
Creates: 2 managers, 8 cashiers, 40 products, 10 members, 50 transactions

#### Seed individual components
```bash
# Users only
docker compose exec backend python -m app.seed --users --managers 2 --cashiers 8

# Products only
docker compose exec backend python -m app.seed --products --product-count 50

# Members only
docker compose exec backend python -m app.seed --members --member-count 10

# Transactions only (requires users, products, members)
docker compose exec backend python -m app.seed --transactions --transaction-count 100 --days-back 30
```

#### Reset and reseed
```bash
# Reset entire database and seed everything
docker compose exec backend python -m app.seed --all --reset-schema

# Reset specific component
docker compose exec backend python -m app.seed --products --reset --product-count 50
```

### 4\. Run Frontend

Navigate to the `frontend` directory, install dependencies, and start the Next.js development server.

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

-----

## 🌐 Access & Credentials

| Service | Address |
| :--- | :--- |
| **Frontend App** | `http://localhost:3000` |
| **Backend API** | `http://localhost:8000` |

### Default User Credentials

After seeding, you can log in with:

| Role | Email / Username | Password |
| :--- | :--- | :--- |
| **Manager** | `manager1@example.com` or `manager1` | `secret12` |
| **Cashier** | `cashier1@example.com` or `cashier1` | `secret12` |

Additional users: `manager2`, `cashier2`, ... `cashier8`

> **Manager Signup Code**: `ef276129` (Required for new manager registration via `/signup` page)

-----

## 🛠️ Maintenance Commands

### Database Migrations

Use Alembic via the Docker container for managing database schema changes:

```bash
# 1. Create a new revision file
docker compose exec backend alembic revision --autogenerate -m "descriptive message"

# 2. Apply migrations
docker compose exec backend alembic upgrade head
```

### Testing

Run unit tests for the FastAPI backend:

```bash
docker compose exec backend bash -lc "PYTHONPATH=/app pytest"
```
