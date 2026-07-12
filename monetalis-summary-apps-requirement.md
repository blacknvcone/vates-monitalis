# Monetalis - KPR Financial Analysis Dashboard

## Status: ✅ MVP Complete

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TanStack (Router, Query, Table) + TailwindCSS 4 + Recharts |
| Backend | Payload CMS 3.x (shared instance) |
| Database | MongoDB Atlas |
| Auth | MonetalisUsers collection (JWT, linked to loan) |
| Email | Nodemailer via Google SMTP |
| Deploy | Docker + K8s + Traefik |

---

## Repositories

| Repo | Purpose | URL |
|------|---------|-----|
| `vates-monitalis` | Frontend SPA | github.com/blacknvcone/vates-monitalis |
| `revamp-portfolio` | Shared CMS + Portfolio | github.com/blacknvcone/revamp-portfolio |
| `obelix` | K8s manifests | github.com/blacknvcone/obelix |

---

## Features

| Feature | Description |
|---------|-------------|
| Dashboard | Summary cards, phase timeline, balance chart, pie chart, next payment, milestones |
| Tabel Angsuran | 240 bulan, TanStack Table, sort/filter/pagination, status toggle |
| Simulator | 3 tab: Early Payoff, Extra Payment, Savings Simulation |
| Insights | Computed from data: key metrics, milestones, opportunity cost, recommendations |
| Email Reminder | Payment reminder + monthly insight, multi-user per loan |
| Settings | Reminder config, users list, per-user test email |
| Auth | Login page, JWT auth, data isolation per loanId |

---

## CMS Collections (Monetalis group)

- `monetalis-users` — Auth users (linked to 1 loan, role: admin/viewer)
- `kpr-loans` — Loan metadata
- `kpr-rate-tiers` — Stepped fixed rate tiers
- `kpr-schedule` — 240-month schedule with payment tracking
- `kpr-extra-payments` — Extra payment log
- `kpr-reminders` — Email reminder config
- `kpr-simulations` — Saved simulations

## Custom Endpoints

- `GET /api/kpr/status` — Current KPR status
- `POST /api/kpr/simulate/early-payoff` — Early payoff simulation
- `POST /api/kpr/simulate/extra-payment` — Extra payment simulation
- `GET /api/kpr/insights` — Financial insights
- `POST /api/kpr/seed` — Seed data (marks paid entries)
- `POST /api/kpr/send-payment-reminder` — Send to all loan users
- `POST /api/kpr/send-monthly-insight` — Send to all loan users
- `POST /api/kpr/send-payment-reminder-test` — Send to specific email
- `POST /api/kpr/send-monthly-insight-test` — Send to specific email

---

## Domains

| Domain | Service |
|--------|---------|
| `monetalis.danipras.dev` | Frontend SPA |
| `cms.danipras.dev` | Payload CMS (shared) |
| `cms.danipras.dev/admin` | CMS admin panel |

---

## Detail

- [README](README.md)
- [PRD](docs/PRD.md)
- [KPR Analysis](KPR-Analysis-Summary.md)
