# Monetalis - KPR Financial Analysis Dashboard

## Product Requirements Document (PRD)

**Version:** 4.0 (Implementation Complete)
**Date:** 12 Juli 2026
**Status:** Implemented — Ready for Deployment

---

## 1. Overview

Web application personal finance dashboard untuk monitoring dan optimasi KPR BRI dengan struktur bunga berjenjang (stepped fixed rate).

- **Frontend**: React SPA dengan TanStack (Router + Query + Table)
- **Backend**: Shared Payload CMS 3.x (repository: `revamp-portfolio`)
- **Database**: MongoDB Atlas
- **Domain**: monetalis.danipras.dev

---

## 2. Implementation Status

### ✅ Phase 1: CMS Collections (revamp-portfolio)

6 collections under `Monetalis` admin group:

| Collection | File | Fields |
|-----------|------|--------|
| `kpr-loans` | `collections/monetalis/KprLoans.ts` | Tab layout: Pinjaman, Dokumen, Aturan Penalti |
| `kpr-rate-tiers` | `collections/monetalis/KprRateTiers.ts` | Tier bunga berjenjang |
| `kpr-schedule` | `collections/monetalis/KprSchedule.ts` | 240 bulan + payment status |
| `kpr-extra-payments` | `collections/monetalis/KprExtraPayments.ts` | Log pembayaran ekstra |
| `kpr-reminders` | `collections/monetalis/KprReminders.ts` | Email reminder config |
| `kpr-simulations` | `collections/monetalis/KprSimulations.ts` | Simulasi tersimpan |

### ✅ Phase 2: CMS Custom Endpoints (revamp-portfolio)

File: `endpoints/kpr.ts` (801 baris)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kpr/status` | Compute current KPR status from schedule |
| POST | `/api/kpr/simulate/early-payoff` | Early payoff simulation with penalty |
| POST | `/api/kpr/simulate/extra-payment` | Extra payment simulation |
| GET | `/api/kpr/insights` | Milestones, opportunity cost, recommendations |
| POST | `/api/kpr/seed` | Seed KPR data (idempotent) |
| POST | `/api/kpr/send-reminder` | Trigger email reminder via Nodemailer |

### ✅ Phase 3: Frontend (vates-monitalis)

| Page | Route | File | Lines | Features |
|------|-------|------|-------|----------|
| Dashboard | `/` | `routes/index.tsx` | 280 | Summary cards, phase timeline, charts, milestone alert |
| Tabel Angsuran | `/schedule` | `routes/schedule.tsx` | 684 | TanStack Table, sort, filter, pagination, status toggle |
| Simulator | `/simulator` | `routes/simulator.tsx` | 680 | Early payoff + extra payment tabs, charts |
| Insights | `/insights` | `routes/insights.tsx` | 370 | Milestones, opportunity cost, recommendations |
| Settings | `/settings` | `routes/settings.tsx` | 350 | Email reminder CRUD, export, system info |

Supporting files:
- `lib/api.ts` — Payload CMS REST client (230 baris)
- `lib/mock-data.ts` — Centralized mock data generator (280 baris)
- `lib/format.ts` — IDR currency, date formatters (90 baris)
- `hooks/index.ts` — TanStack Query hooks (170 baris)
- `types/index.ts` — TypeScript interfaces (170 baris)

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────┐
│  K8s Cluster                                         │
│                                                      │
│  ┌─────────────────┐    ┌──────────────────────┐     │
│  │  web (SPA)       │    │  cms (Payload 3.x)   │     │
│  │  Vite + React    │───►│  Next.js 15          │     │
│  │  TanStack        │API │  REST + GraphQL      │     │
│  │  port 3000       │    │  Auth (JWT + API Key)│     │
│  │  nginx           │    │  port 3001           │     │
│  └─────────────────┘    └──────┬───────┬───────┘     │
│                                 │       │             │
│                          ┌──────▼──┐ ┌──▼────────┐    │
│                          │ MongoDB │ │ Google    │    │
│                          │ Atlas   │ │ SMTP      │    │
│                          └─────────┘ └───────────┘    │
│                                                      │
│  Traefik IngressRoute:                               │
│    monetalis.danipras.dev       → web:3000            │
│    monetalis.danipras.dev/api   → cms:3001            │
│    monetalis.danipras.dev/admin → cms:3001            │
└──────────────────────────────────────────────────────┘
```

---

## 4. Build Output

```
dist/assets/index-BG_EXK6p.js     277 KB (81 KB gzip)   — App code
dist/assets/tanstack-BwwBySp9.js  183 KB (55 KB gzip)   — TanStack
dist/assets/charts-D7KmDOWB.js    432 KB (115 KB gzip)  — Recharts
dist/assets/index-CCsranA2.css     29 KB (6 KB gzip)    — Styles
```

---

## 5. Pending for Deployment

- [ ] Build & deploy CMS with new collections + endpoints
- [ ] Seed KPR data via `POST /api/kpr/seed`
- [ ] Dockerfile for web (Vite static + nginx)
- [ ] K8s manifests (Deployment, Service, IngressRoute)
- [ ] CORS configuration in CMS for monetalis domain
- [ ] Google SMTP app password for email reminders
