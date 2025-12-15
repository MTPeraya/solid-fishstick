# 🏪 Minimart POS & Inventory Management System 

## Overview

This is a full-stack Point-of-Sale (POS) and inventory management application designed for minimarts and small retail businesses. It provides two main user roles: a **Cashier** interface for processing sales and a **Manager** dashboard for business oversight.

### Key Features

**For Cashiers (POS):**
- 🔍 Product search by name, brand, category, or barcode
- 📷 Barcode scanning support
- 🛒 Real-time cart management with quantity controls
- 💰 Automatic discount calculation (promotions + membership)
- 👤 Member lookup and quick registration
- 💳 Multiple payment methods (Cash, Card, QR Code)
- 📊 Live price breakdown showing all discounts

**For Managers:**
- 📈 **Analytics Dashboard** - Comprehensive business insights with interactive charts
  - Revenue, profit, and transaction metrics
  - Top products by revenue and quantity
  - 30-day sales trend visualization
  - Payment method distribution
  - Category performance rankings
- 📦 **Inventory Management** - Track stock levels and low stock alerts
- 🏷️ **Product Management** - Add, edit, and manage product catalog
- 🎁 **Promotions** - Create percentage or fixed-amount discounts
- 👥 **Membership System** - 4-tier system (Bronze, Silver, Gold, Platinum) with automatic tier upgrades
- 💼 **Employee Management** - Manage cashier and manager accounts
- 💵 **Sales Reports** - Detailed transaction history with discount breakdowns

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
Creates: 
- 4 membership tiers (Bronze, Silver, Gold, Platinum)
- 2 managers + 8 cashiers
- 4 active promotions
- 40 products across 10 categories (~30% with promotions, ~15% low stock)
- 10 members with varying spending levels
- 50 transactions with realistic items and discounts

#### Seed individual components
```bash
# Users only
docker compose exec backend python -m app.seed --users --managers 2 --cashiers 8

# Promotions only
docker compose exec backend python -m app.seed --promotions --promotion-count 4

# Products only (with promotion assignment)
docker compose exec backend python -m app.seed --products --product-count 50

# Members only
docker compose exec backend python -m app.seed --members --member-count 10

# Transactions only (requires users, products, members, promotions)
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

### Test Member Accounts

After seeding, test members with different tiers:

| Phone | Tier | Discount |
| :--- | :--- | :--- |
| `0810000000` - `0810000009` | Bronze - Silver | 3% - 5% |

> **Note**: Member tiers are automatically upgraded based on rolling 12-month spending:
> - Bronze: ฿0 - ฿4,999 (3% discount)
> - Silver: ฿5,000 - ฿19,999 (5% discount)
> - Gold: ฿20,000 - ฿59,999 (8% discount)
> - Platinum: ฿60,000+ (12% discount)

> **Manager Signup Code**: `ef276129` (Required for new manager registration via `/signup` page)

-----

## 💡 Features in Detail

### Discount System

The system supports **two types of discounts** that stack:

1. **Product Promotions** (applied first)
   - Percentage discounts (e.g., 15% off)
   - Fixed amount discounts (e.g., ฿5 off)
   - Date-based activation
   - Visible in POS with red badges

2. **Membership Discounts** (applied to subtotal after promotions)
   - Tier-based percentages (3%, 5%, 8%, 12%)
   - Automatic tier upgrades based on spending
   - Applied at checkout when member phone is entered

**Example:**
- Product: ฿100 with 10% promotion = ฿90
- Member: Silver tier (5% discount) = ฿90 - ฿4.50 = ฿85.50 final price

### Analytics Dashboard

The manager dashboard provides real-time business insights:

- **KPI Cards**: Revenue, Profit (with margin %), Transactions, Avg Daily Sales, Low Stock Alerts
- **Top Products by Revenue**: Horizontal bar chart showing best-selling products by money earned
- **Top Products by Quantity**: Horizontal bar chart showing most popular items by units sold
- **Sales Trend**: 30-day line chart with interactive tooltips
- **Payment Methods**: Donut chart showing Cash/Card/QR distribution
- **Category Rankings**: Performance breakdown by product category
- **Product Performance Table**: Detailed rankings with revenue, quantity, and average price

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
