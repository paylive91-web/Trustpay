# TrustPay - P2P Payment Platform

## Overview

TrustPay is a P2P (peer-to-peer) UPI payment platform where users can deposit (buy) and withdraw (sell) funds, earning rewards on transactions. Admins can manage UPI settings, approve/reject orders, configure the app, and broadcast notifications.

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
- Registration/Login (phone + OTP + password)
- Optional referral code during registration
- Home Dashboard: balance display, BUY and SELL buttons, auto-scrolling banner, buy/sell rules
- Buy (Deposit): task list with shuffling (2x speed), full-screen payment page with UPI details + UTR + screenshot upload, active deposit blocker, approval polling with success popup
- Sell (Withdrawal): create withdrawal order (custom amount in multiples of 100), pay other users' withdrawals
- Orders list (Buy shows reward, Sell shows UPI details)
- Transaction history
- Profile: account stats, invite earnings (L1/L2), referral code display
- Invite & Earn page: share referral code/link, commission breakdown, earnings summary
- Support page with Telegram redirect (admin-configurable)
- Startup popup: once-daily, multiple announcements + broadcast notifications from admin

### Admin Side (Default: admin / password)
- Separate admin login at /admin
- Dashboard: daily deposit/withdrawal stats
- Orders management: approve/reject/edit orders, view UTR + payment screenshot, set reward %
- Users management: view all users, update balances, see invite earnings (L1/L2), referral codes
- Settings: Multiple UPI IDs each with optional QR code, multiple daily announcements, legacy popup, telegram link, banner images, buy/sell rules, change admin password
- Deposit Tasks CRUD: manage available deposit amounts and reward %
- Broadcast Notification: send one-time popup message to all users

## Reward & Commission System
- Deposit tasks: configurable % (default 4%)
- Withdrawal tiers: 100-1000 INR = 5%, 1001-2000 INR = 4%, 2001-50000 INR = 3%
- Referral commissions on deposit approval: L1 (direct invite) = 1%, L2 (invite's invite) = 0.1%

## DB Schema

- `users`: id, username, phone, password_hash, balance, total_deposits, total_withdrawals, invite_earnings, invite_earnings_l2, referral_code, referred_by, role, created_at
- `orders`: id, user_id, type (deposit/withdrawal), amount, reward_percent, reward_amount, total_amount, status, upi_id, upi_name, user_upi_id, user_upi_name, user_name, utr_number, screenshot_url, notes, created_at, updated_at
- `referrals`: id, referrer_id, referred_user_id, order_id, level, commission_amount, created_at
- `deposit_tasks`: id, amount, reward_percent, is_active
- `transactions`: id, user_id, order_id, type (credit/debit), amount, description, created_at
- `settings`: key, value (key-value store for all app settings)
