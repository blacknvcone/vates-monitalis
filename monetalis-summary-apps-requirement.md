# Monetalis - KPR Financial Analysis Dashboard

## Requirement Overview

Monitoring KPR dengan struktur bunga berjenjang (stepped fixed rate) — dashboard keuangan, simulasi pembayaran, reminder email.

---

## Architecture Decision

> **Payload CMS 3.x sebagai backend** — tidak perlu API terpisah.
> Payload auto-generates REST & GraphQL API, built-in auth, admin panel.
> Mengikuti pattern yang sudah established di `revamp-portfolio`.

```
Browser → [web:3000] → Payload REST API → [MongoDB Atlas]
                            ↘ [Google SMTP]
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TanStack (Router + Query + Table) + TailwindCSS + shadcn/ui |
| Backend | Payload CMS 3.x (Next.js 15) |
| Database | MongoDB Atlas (shared cluster, DB: monetalis) |
| Auth | Payload built-in JWT + API key |
| Email | Nodemailer via Google SMTP |
| Monorepo | Turborepo + pnpm |
| Deploy | Docker + K8s + Traefik |
| Domain | monetalis.danipras.dev |

---

## Features

1. **Dashboard** — Summary KPR, progress, key metrics, charts
2. **Tabel Angsuran** — 240 bulan, TanStack Table, toggle is_paid
3. **Simulator** — Early payoff, extra payment, scenario comparison
4. **Insights** — Opportunity cost, milestones, rekomendasi
5. **Email Reminder** — Konfigurasi, template, cron job
6. **Settings** — Edit data, rate tiers, export

---

## Data Model (Payload Collections)

- `kpr-loans` — Metadata pinjaman
- `kpr-rate-tiers` — Tier suku bunga berjenjang
- `kpr-schedule` — Jadwal angsuran 240 bulan (seeded from CSV)
- `kpr-extra-payments` — Log pembayaran ekstra
- `kpr-reminders` — Konfigurasi email reminder
- `kpr-simulations` — Skenario simulasi tersimpan

---

## Custom Endpoints

- `GET /api/kpr/status` — Status KPR saat ini (computed)
- `POST /api/kpr/simulate/early-payoff` — Simulasi pelunasan dipercepat
- `POST /api/kpr/simulate/extra-payment` — Simulasi bayar ekstra
- `GET /api/kpr/insights` — Financial insights
- `POST /api/kpr/send-reminder` — Trigger email reminder
- `POST /api/kpr/seed` — Seed data dari CSV

---

## Implementation Phases

| Phase | Scope |
|-------|-------|
| 1. Foundation | Monorepo, Payload CMS, collections, seed, auth, dashboard |
| 2. Core | Tabel Angsuran, charts, payment tracking, status endpoint |
| 3. Simulator | Early payoff, extra payment, comparison |
| 4. Insights & Email | Insights engine, milestones, email reminders |
| 5. Deploy | Docker, K8s, Traefik, CI/CD |

---

## Detail

Full PRD: [docs/PRD.md](docs/PRD.md)
