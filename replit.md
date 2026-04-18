# TrustPay - P2P Payment Platform

## Overview

TrustPay is a self-contained P2P (peer-to-peer) UPI payment platform. Users can BUY balance from other users (paying via UPI directly to seller) and SELL balance via Auto-Sell (UPI Connect activates random chunking of balance into the buy queue). Buyers earn 3-5% reward depending on amount tier. The platform never holds the UPI rails — it only matches and arbitrates trades.

There is no external payment gateway — all flows are internal P2P.

## Architecture

Monorepo (pnpm workspace) with three artifacts:
- `artifacts/api-server` — Express + Drizzle ORM + PostgreSQL backend on `$PORT`
- `artifacts/trustpay` — React + Vite frontend (mobile-first)
- `artifacts/mockup-sandbox` — design preview server (canvas)

Shared libs:
- `lib/db` — Drizzle schema (`users`, `orders`, `transactions`, `settings`, `referrals`, `user_upi_ids`, `disputes`, `fraud_alerts`, `trust_events`, `utr_index`, `image_hashes`)
- `lib/api-client-react` — orval-generated React Query hooks (legacy hooks remain; new P2P endpoints use raw fetch from frontend)

## P2P Trade Lifecycle

1. **Auto-Sell**: Seller connects UPI → `autoSellEnabled=true`. Their balance is split into random chunks (default ₹99-₹499; new users <5 trades capped at ₹500) inserted as `orders.type=withdrawal status=available`.
2. **Lock**: Buyer picks a chunk → 15 min countdown to pay & submit. One active buy per user (enforced server-side).
3. **Submit**: Buyer uploads UTR + payment screenshot + screen recording → status=`pending_confirmation` → seller has 15 min to confirm.
4. **Confirm**: Seller "YES" → settle (buyer credited amount + reward, seller debited amount, both +1 trust, both `successfulTrades++`). If seller times out → auto-confirm (buyer wins, seller -2 trust).
5. **Dispute**: Seller "NO" → status=`disputed`, both parties have 24h to upload proof. Admin resolves; silent party auto-loses (-10 trust).

Reward tiers: ≤₹1000 → 5%, ₹1001-2000 → 4%, ₹2001+ → 3%. Referral commissions (L1=1%, L2=0.1%) trigger on settled buys.

## Trust Score & Fraud

- Trust starts at 0, capped at +100, freeze at -80.
- Fraud rules: duplicate UTR, fake UTR patterns, duplicate image hashes, velocity bursts, UPI multi-account. Critical hits auto-freeze.

## Auth

Phone+password only. JWT (30d) signed with `SESSION_SECRET`. Admin login uses settings-stored bcrypt hash (default user `admin`/`password`).

## Routes

`/api/auth/*`, `/api/upi`, `/api/p2p/*`, `/api/disputes/*`, `/api/orders/*`, `/api/transactions/*`, `/api/dashboard/*`, `/api/settings/*`, `/api/admin/*` (orders, users, fraud-alerts, settings, deposit-tasks, notify-all, stats).

Frontend pages: `/`, `/login`, `/register`, `/buy`, `/sell`, `/orders`, `/transactions`, `/profile`, `/invite`, `/support`, `/admin`, `/admin/dashboard`, `/admin/orders`, `/admin/disputes`, `/admin/users`, `/admin/settings`, `/admin/deposit-tasks`.

## Migrations

`drizzle-kit push` may hang on interactive prompts in this env. Apply additive schema changes via raw SQL in code_execution sandbox (`executeSql({ sqlQuery })`) — see `.local/tasks/task-1.md` for the migration that introduced the P2P tables.

## Outstanding TODO

- ~14 of 20+ planned fraud rules (only 6 implemented: duplicate UTR, fake UTR patterns, duplicate image hashes, velocity, UPI reuse).
- Fraud Watch admin UI (backend list endpoint exists at `/api/admin/fraud-alerts`).
- High-value deposit tracking UI.
- Buyer-side dispute proof upload UI on `/orders`.
