# Monetalis — KPR Financial Analysis Dashboard

Personal finance dashboard untuk monitoring dan optimasi Kredit Pemilikan Rumah (KPR) dengan struktur bunga berjenjang (stepped fixed rate).

## Features

- **Dashboard** — Ringkasan keuangan KPR: sisa pokok, total bunga, progress pembayaran, fase bunga aktif
- **Tabel Angsuran** — 240 bulan angsuran dengan TanStack Table (sort, filter, status tracking)
- **Simulator** — Simulasi pelunasan dipercepat dan pembayaran ekstra
- **Financial Insights** — Analisa opportunity cost, milestone alerts, rekomendasi strategi
- **Email Reminder** — Pengingat angsuran bulanan via Google SMTP
- **Settings** — Konfigurasi reminder, export data, link ke CMS admin

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 |
| Routing | TanStack Router (file-based) |
| Data Fetching | TanStack Query |
| Data Tables | TanStack Table |
| Charts | Recharts |
| Styling | TailwindCSS 4 + shadcn/ui |
| Backend | Payload CMS 3.x (shared, [revamp-portfolio](https://github.com/blacknvcone/revamp-portfolio)) |
| Database | MongoDB Atlas |
| Auth | Payload built-in JWT + API key |
| Email | Nodemailer via Google SMTP |
| Deploy | Docker + K8s + Traefik |

## Architecture

```
┌──────────────────────┐          ┌──────────────────────┐
│ monetalis.danipras.dev│          │ cms.danipras.dev     │
│                      │          │                      │
│  Vite SPA (nginx)    │──API───►│  Payload CMS 3.x     │
│  Dashboard, Table,   │  calls  │  REST + GraphQL      │
│  Simulator, Insights │          │  Admin Panel /admin  │
│                      │          │       │         │    │
└──────────────────────┘          └───────▼─────────▼────┘
                                   MongoDB Atlas  Google SMTP
```

Frontend adalah standalone SPA yang memanggil Payload CMS REST API langsung ke `cms.danipras.dev`. CMS di-deploy terpisah dan juga melayani aplikasi lain (portfolio web).

### Domains

| Domain | Service | Description |
|--------|---------|-------------|
| `monetalis.danipras.dev` | Monetalis Web | Frontend SPA (Vite + nginx) |
| `cms.danipras.dev` | Payload CMS | Shared backend + admin panel |
| `cms.danipras.dev/admin` | Payload Admin | CMS admin interface |
| `cms.danipras.dev/api/*` | Payload REST API | Auto-generated + custom endpoints |

## Project Structure

```
src/
├── routes/              # TanStack Router file-based routes
│   ├── __root.tsx       # Root layout + sidebar navigation
│   ├── index.tsx        # Dashboard
│   ├── schedule.tsx     # Tabel Angsuran (TanStack Table)
│   ├── simulator.tsx    # Payment Simulator
│   ├── insights.tsx     # Financial Insights
│   └── settings.tsx     # Settings & Reminders
├── lib/
│   ├── api.ts           # Payload CMS REST API client
│   ├── mock-data.ts     # Mock data generator (until CMS connected)
│   ├── format.ts        # IDR currency, date, percentage formatters
│   └── utils.ts         # Utility functions
├── hooks/
│   └── index.ts         # TanStack Query hooks
└── types/
    └── index.ts         # TypeScript interfaces
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server (port 3000, proxies /api to localhost:3001)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Environment Variables

```env
# Production
VITE_CMS_URL=https://cms.danipras.dev

# Local development
VITE_CMS_URL=http://localhost:3001
```

## CMS Backend

Backend menggunakan Payload CMS 3.x yang shared dengan aplikasi lain.

- Repository: [revamp-portfolio](https://github.com/blacknvcone/revamp-portfolio)
- Admin panel: [cms.danipras.dev/admin](https://cms.danipras.dev/admin)

### Collections (grouped under "Monetalis" in admin)

| Collection | Description |
|-----------|-------------|
| `kpr-loans` | Metadata pinjaman KPR |
| `kpr-rate-tiers` | Tier suku bunga berjenjang |
| `kpr-schedule` | Jadwal angsuran 240 bulan |
| `kpr-extra-payments` | Log pembayaran ekstra |
| `kpr-reminders` | Konfigurasi email reminder |
| `kpr-simulations` | Skenario simulasi tersimpan |

### Custom Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kpr/status` | Status KPR saat ini (computed) |
| POST | `/api/kpr/simulate/early-payoff` | Simulasi pelunasan dipercepat |
| POST | `/api/kpr/simulate/extra-payment` | Simulasi pembayaran ekstra |
| GET | `/api/kpr/insights` | Financial insights & milestones |
| POST | `/api/kpr/seed` | Seed data KPR dari parameter |
| POST | `/api/kpr/send-reminder` | Trigger email reminder |

## Deployment

### CI/CD

Push tag `v*` untuk trigger GitHub Actions:
1. Build Docker image (Vite + nginx)
2. Push ke GitHub Container Registry (GHCR)
3. Webhook trigger rolling restart di K8s

```bash
git tag -a v1.0.1 -m "release" && git push origin v1.0.1
```

### K8s

Manifests di-deploy di [obelix](https://github.com/blacknvcone/obelix) repo:

```
obelix/monetalis/
├── monetalis-namespace.yaml
├── monetalis-web-deployment.yaml
├── monetalis-web-service.yaml
└── monetalis-web-ingressroute.yaml
```

```bash
kubectl apply -f monetalis/monetalis-namespace.yaml
kubectl apply -f monetalis/monetalis-web-deployment.yaml
kubectl apply -f monetalis/monetalis-web-service.yaml
kubectl apply -f monetalis/monetalis-web-ingressroute.yaml
```

### Restart after new image

```bash
kubectl rollout restart deployment/monetalis-web -n monetalis
```

Or via webhook (automatic on tag push).

## KPR Data

Loan: BRI KPR Rp 415.000.000, tenor 240 bulan, first payment November 2023.

| Phase | Period | Rate | Installment |
|-------|--------|------|-------------|
| 1 | Nov 2023 - Okt 2026 | 4.75% | Rp 2.681.900/bln |
| 2 | Nov 2026 - Okt 2029 | 8.00% | Rp 3.367.400/bln |
| 3 | Nov 2029 - Okt 2043 | 10.25% | Rp 3.815.600/bln |

Total bunga 20 tahun: Rp 443.782.131 (107% dari pokok).
