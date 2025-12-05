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

Run the seeding script to populate the database.

#### Seed all data (users, members, products, tiers)

This command sets up default user accounts (manager, cashier) and a small set of products.

```bash
docker compose exec backend python -m app.seed
```

#### Seed products only (e.g., to generate 40 sample products)

Use this command to populate only the product table, useful for testing inventory features.

```bash
docker compose exec backend bash -lc 'PYTHONPATH=/app python3 -m app.seed --products-only --count 40'
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

If you ran the main seeding script, you can log in with these default accounts:

| Role | Identifier (Email/Username) | Password |
| :--- | :--- | :--- |
| **Manager** | `manager@example.com` or `manager` | `secret12` |
| **Cashier** | `cashier@example.com` or `cashier` | `secret12` |

> **Manager Signup Code**: `ef276129` (This secret code is required if a user attempts to register a new manager account via the `/signup` page).

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
