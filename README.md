# Monetalis — KPR Financial Analysis Dashboard

Personal finance dashboard untuk monitoring dan optimasi Kredit Pemilikan Rumah (KPR) dengan struktur bunga berjenjang (stepped fixed rate).

**Status:** MVP Complete ✅

---

## Features

- **Dashboard** — Ringkasan keuangan KPR: sisa pokok, total bunga, progress, fase bunga aktif, milestone alerts
- **Tabel Angsuran** — 240 bulan angsuran dengan TanStack Table (sort, filter, pagination, status tracking)
- **Simulator** — 3 tab: Pelunasan Dipercepat, Pembayaran Ekstra, Simulasi Menabung
- **Financial Insights** — Analisa opportunity cost, milestone alerts, rekomendasi strategi (semua computed dari data aktual)
- **Email Reminder** — 2 jenis email: Pengingat Pembayaran + Laporan Bulanan (multi-user per loan)
- **Settings** — Konfigurasi reminder, users dengan akses, test email per-user

---

## Architecture

```
┌──────────────────────┐          ┌──────────────────────┐
│ monetalis.danipras.dev│          │ cms.danipras.dev     │
│                      │          │                      │
│  Vite SPA (nginx)    │──API───►│  Payload CMS 3.x     │
│  React + TanStack    │  calls  │  REST + GraphQL      │
│  Recharts + Tailwind │          │  Admin Panel /admin  │
│                      │          │       │         │    │
└──────────────────────┘          └───────▼─────────▼────┘
                                   MongoDB Atlas  Google SMTP
```

### Domains

| Domain | Service | Description |
|--------|---------|-------------|
| `monetalis.danipras.dev` | Monetalis Web | Frontend SPA (Vite + nginx) |
| `cms.danipras.dev` | Payload CMS | Shared backend + admin panel |
| `cms.danipras.dev/admin` | Payload Admin | CMS admin interface |
| `cms.danipras.dev/api/*` | Payload REST API | Auto-generated + custom endpoints |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TanStack Router/Query/Table |
| Charts | Recharts |
| Styling | TailwindCSS 4 |
| Backend | Payload CMS 3.x (shared, [revamp-portfolio](https://github.com/blacknvcone/revamp-portfolio)) |
| Database | MongoDB Atlas |
| Auth | Payload built-in JWT (MonetalisUsers collection) |
| Email | Nodemailer via Google SMTP |
| Deploy | Docker + K8s + Traefik |
| CI/CD | GitHub Actions (tag `v*` → build → push GHCR → webhook restart) |

---

## Project Structure

```
src/
├── routes/                  # TanStack Router (file-based)
│   ├── __root.tsx           # Root layout + auth guard + sidebar nav
│   ├── index.tsx            # Dashboard (summary cards, charts, timeline)
│   ├── schedule.tsx         # Tabel Angsuran (TanStack Table, 240 rows)
│   ├── simulator.tsx        # 3-tab simulator (payoff, extra, savings)
│   ├── insights.tsx         # Financial insights (computed from data)
│   ├── settings.tsx         # Reminder config, users, test email
│   └── login.tsx            # Login page
├── lib/
│   ├── api.ts               # Payload CMS REST API client
│   ├── auth.tsx             # AuthContext provider + useAuth hook
│   ├── mock-data.ts         # Mock data generator (until CMS connected)
│   ├── format.ts            # IDR currency, date, percentage formatters
│   └── utils.ts             # cn() utility
├── hooks/
│   └── index.ts             # TanStack Query hooks (auto-include loanId)
└── types/
    └── index.ts             # TypeScript interfaces
```

---

## CMS Collections (Monetalis group)

| Collection | Description |
|-----------|-------------|
| `monetalis-users` | Users with auth (linked to 1 loan, role: admin/viewer) |
| `kpr-loans` | Loan metadata (tab layout: Pinjaman, Dokumen, Aturan Penalti) |
| `kpr-rate-tiers` | Stepped fixed interest rate tiers |
| `kpr-schedule` | 240-month amortization schedule with payment tracking |
| `kpr-extra-payments` | Extra payment log |
| `kpr-reminders` | Email reminder config (day, types, last sent) |
| `kpr-simulations` | Saved payment simulations |

### Custom Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kpr/status` | Current KPR status (computed) |
| POST | `/api/kpr/simulate/early-payoff` | Early payoff simulation |
| POST | `/api/kpr/simulate/extra-payment` | Extra payment simulation |
| GET | `/api/kpr/insights` | Financial insights & milestones |
| POST | `/api/kpr/seed` | Seed KPR data (idempotent, marks paid entries) |
| POST | `/api/kpr/send-payment-reminder` | Send to all users on loan |
| POST | `/api/kpr/send-monthly-insight` | Send to all users on loan |
| POST | `/api/kpr/send-payment-reminder-test` | Send to specific email |
| POST | `/api/kpr/send-monthly-insight-test` | Send to specific email |

---

## Getting Started

```bash
pnpm install
pnpm dev          # Port 3000, proxies /api to localhost:3001
pnpm build        # Production build
```

### Environment Variables

```env
VITE_CMS_URL=https://cms.danipras.dev   # Production
VITE_CMS_URL=http://localhost:3001       # Local development
```

---

## Deployment

### CI/CD

Push tag `v*` → GitHub Actions → Build Docker → Push GHCR → Webhook restart

```bash
git tag -a v1.6.1 -m "release" && git push origin v1.6.1
```

### K8s Manifests

Located in [obelix](https://github.com/blacknvcone/obelix) repo:

```
obelix/monetalis/
├── monetalis-namespace.yaml          # namespace: monetalis
├── monetalis-web-deployment.yaml     # nginx + SPA, heimdall-vm, GHCR
├── monetalis-web-service.yaml        # ClusterIP:80
└── monetalis-web-ingressroute.yaml   # Traefik + Let's Encrypt
```

```bash
cd obelix
kubectl apply -f monetalis/monetalis-namespace.yaml
kubectl apply -f monetalis/monetalis-web-deployment.yaml
kubectl apply -f monetalis/monetalis-web-service.yaml
kubectl apply -f monetalis/monetalis-web-ingressroute.yaml
```

---

## User-Loan Relationship

- 1 MonetalisUser → 1 KPR Loan (required)
- 1 KPR Loan → N MonetalisUsers (multi-user)
- Users only see data for their assigned loan
- Email reminders sent to ALL users on the same loan

---

## Email System

| Type | Subject | Content |
|------|---------|---------|
| Payment Reminder | 🔔 Pengingat Angsuran KPR - [Month Year] | Next payment, due date, breakdown, progress |
| Monthly Insight | 📊 Laporan Bulanan KPR - [Month Year] | Summary, accumulation, milestones, recommendations |

- Sent via Google SMTP (Nodemailer)
- Configurable day of month (1-28)
- Per-user test buttons in Settings

---

## KPR Data

Loan: BRI KPR Rp 415,000,000, tenor 240 bulan, first payment November 2023.

| Phase | Period | Rate | Installment |
|-------|--------|------|-------------|
| 1 | Nov 2023 - Okt 2026 | 4.75% | Rp 2,681,900/bln |
| 2 | Nov 2026 - Okt 2029 | 8.00% | Rp 3,367,400/bln |
| 3 | Nov 2029 - Okt 2043 | 10.25% | Rp 3,815,600/bln |

Total bunga 20 tahun: Rp 443,782,131 (107% dari pokok).
