# TrustPay - P2P Payment Platform

## Overview

TrustPay is a P2P (peer-to-peer) UPI payment platform where users can deposit (buy) and withdraw (sell) funds, earning rewards on transactions. Admins can manage UPI settings, approve/reject orders, and configure the app.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite + Tailwind CSS (artifacts/trustpay)
- **Backend**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (bcryptjs for hashing, jsonwebtoken)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## App Features

### User Side
- Registration/Login (username + password)
- Home Dashboard: balance display, BUY and SELL buttons, auto-scrolling banner
- Buy (Deposit): task list with INR amounts and 4% rewards, UPI payment modal
- Sell (Withdrawal): create withdrawal order, pay other users' withdrawals to earn rewards
- Orders list, transaction history
- Support page with Telegram redirect (admin-configurable)
- Startup popup with admin-configurable message and image

### Admin Side (Default: admin / password)
- Separate admin login at /admin
- Dashboard: daily deposit/withdrawal stats
- Orders management: approve/reject/edit orders, set reward %
- Users management: view all users, update balances
- Settings: UPI ID/Name, popup message/image, telegram link, banner images
- Deposit Tasks CRUD: manage available deposit amounts and reward %

## Reward System
- Deposit tasks: configurable % (default 4%)
- Withdrawal tiers: 100-1000 INR = 5%, 1001-2000 INR = 4%, 2001-50000 INR = 3%

## Database Schema
- `users` — user accounts with balance tracking
- `deposit_tasks` — available deposit tasks with amounts and reward %
- `orders` — deposit and withdrawal orders
- `transactions` — credit/debit transaction history
- `settings` — key-value app configuration

## Default Admin Credentials
- Username: `admin`
- Password: `password`

## Project Structure

```
artifacts/
  api-server/       — Express REST API
  trustpay/         — React frontend
lib/
  api-spec/         — OpenAPI spec + Orval config
  api-client-react/ — Generated React Query hooks
  api-zod/          — Generated Zod schemas
  db/               — Database schema (Drizzle)
```
