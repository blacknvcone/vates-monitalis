# Monetalis - KPR Financial Analysis Dashboard

## Product Requirements Document (PRD)

**Version:** 2.0 (Revised)
**Date:** 12 Juli 2026
**Status:** Ready for Implementation

---

## 1. Overview

### 1.1 Problem Statement

Monitoring KPR dengan struktur bunga berjenjang (stepped fixed rate) membutuhkan tool yang bisa merangkum data keuangan, mensimulasikan skenario pembayaran, dan mengirim reminder otomatis.

### 1.2 Solution

Web application personal finance dashboard:
- **Frontend**: React SPA dengan TanStack (Router + Query + Table)
- **Backend**: Payload CMS 3.x (REST API + Auth + Admin Panel)
- **Database**: MongoDB (shared cluster dengan portfolio CMS, database terpisah)
- **Email**: Nodemailer via Google SMTP

### 1.3 Key Architecture Decision

> **Payload CMS sebagai backend** — menghilangkan kebutuhan untuk membangun API terpisah (Hono/Express).
> Payload auto-generates REST & GraphQL API untuk semua collections, plus built-in auth.
> Mengikuti pattern yang sudah established di `revamp-portfolio` monorepo.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  K8s Cluster                                                 │
│                                                              │
│  ┌─────────────────┐     ┌──────────────────────┐           │
│  │  web (SPA)       │     │  cms (Payload 3.x)   │           │
│  │  Vite + React    │────►│  Next.js 15          │           │
│  │  TanStack        │ API │  REST + GraphQL      │           │
│  │  port 3000       │     │  Auth (JWT + API Key)│           │
│  │                  │     │  Admin Panel /admin  │           │
│  │  nginx           │     │  port 3001           │           │
│  └─────────────────┘     └──────┬───────┬───────┘           │
│                                  │       │                   │
│                           ┌──────▼──┐ ┌──▼────────┐         │
│                           │ MongoDB │ │ Google    │         │
│                           │ Atlas   │ │ SMTP      │         │
│                           └─────────┘ └───────────┘         │
│                                                              │
│  Traefik IngressRoute:                                       │
│    monetalis.danipras.dev      → web:3000                    │
│    monetalis.danipras.dev/api  → cms:3001                    │
│    monetalis.danipras.dev/admin → cms:3001                   │
└──────────────────────────────────────────────────────────────┘
```

### 2.1 Why Payload CMS as Backend?

| Aspect | Payload CMS | Custom API (Hono) |
|--------|------------|-------------------|
| Auth | Built-in (JWT, API keys) | Harus build sendiri |
| CRUD API | Auto-generated | Manual |
| Admin Panel | Gratis (React admin) | Harus build sendiri |
| Type Safety | Auto-generate types | Manual |
| Deployment | Pattern sudah ada | Pattern baru |
| Effort | ~50% lebih sedikit | Full custom |

### 2.2 Monorepo Structure

```
vates-monitalis/
├── apps/
│   ├── web/                          # Frontend SPA
│   │   ├── src/
│   │   │   ├── routes/               # TanStack Router file-based routes
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx         # Dashboard
│   │   │   │   ├── schedule.tsx      # Tabel Angsuran
│   │   │   │   ├── simulator.tsx     # Payment Simulator
│   │   │   │   ├── insights.tsx      # Financial Insights
│   │   │   │   └── settings.tsx      # Settings
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui components
│   │   │   │   ├── dashboard/        # Dashboard components
│   │   │   │   ├── schedule/         # Table components
│   │   │   │   ├── simulator/        # Simulator components
│   │   │   │   └── insights/         # Insight components
│   │   │   ├── lib/
│   │   │   │   ├── api.ts            # Payload API client
│   │   │   │   ├── auth.ts           # Auth helpers
│   │   │   │   └── utils.ts          # Utilities
│   │   │   ├── hooks/                # Custom hooks
│   │   │   └── styles/
│   │   ├── Dockerfile
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── cms/                          # Payload CMS (backend)
│       ├── src/
│       │   ├── collections/
│       │   │   ├── Users.ts          # Auth users (existing pattern)
│       │   │   ├── KprLoans.ts       # KPR loan metadata
│       │   │   ├── KprRateTiers.ts   # Interest rate tiers
│       │   │   ├── KprSchedule.ts    # Amortization schedule (240 rows)
│       │   │   ├── KprExtraPayments.ts # Extra payments log
│       │   │   ├── KprReminders.ts   # Email reminder config
│       │   │   └── KprSimulations.ts # Saved simulations
│       │   ├── endpoints/
│       │   │   ├── simulate.ts       # Custom: run simulations
│       │   │   ├── insights.ts       # Custom: financial insights
│       │   │   ├── status.ts         # Custom: current KPR status
│       │   │   └── send-reminder.ts  # Custom: trigger email
│       │   ├── hooks/                # Collection hooks
│       │   ├── jobs/
│       │   │   └── reminder-cron.ts  # Scheduled email reminders
│       │   ├── payload.config.ts
│       │   └── app/                  # Next.js app dir (admin)
│       ├── Dockerfile
│       ├── infra/                    # K8s manifests
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   ├── ingressroute.yaml
│       │   └── namespace.yaml
│       ├── .env.example
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared types & utils
│       └── src/
│           ├── types.ts              # TypeScript interfaces
│           ├── schemas.ts            # Zod schemas
│           └── utils.ts              # Currency format, date helpers
│
├── docker-compose.yaml               # Local dev
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 3. Payload CMS Collections (Data Model)

### 3.1 Users (built-in, same pattern as portfolio)

```typescript
// Same as revamp-portfolio/apps/cms/src/collections/Users.ts
// Auth with JWT + API key support
```

### 3.2 KprLoans

```typescript
export const KprLoans: CollectionConfig = {
  slug: 'kpr-loans',
  admin: { useAsTitle: 'borrowerName', group: 'KPR' },
  fields: [
    { name: 'borrowerName', type: 'text', required: true },
    { name: 'coBorrower', type: 'text' },
    { name: 'bankName', type: 'text', required: true, defaultValue: 'BRI' },
    { name: 'branch', type: 'text' },
    { name: 'loanAmount', type: 'number', required: true, min: 0 },
    { name: 'housePrice', type: 'number', required: true },
    { name: 'downPayment', type: 'number', required: true },
    { name: 'tenorMonths', type: 'number', required: true, defaultValue: 240 },
    { name: 'firstPayment', type: 'date', required: true },
    { name: 'offeringLetterRef', type: 'text' },
    { name: 'propertyAddress', type: 'textarea' },
    { name: 'certificateNo', type: 'text' },
    { name: 'collateralValue', type: 'number' },
    // Penalty rules
    { name: 'penaltyBeforeMinTenor', type: 'number', defaultValue: 10 }, // %
    { name: 'penaltyAfterMinTenor', type: 'number', defaultValue: 2.5 }, // %
    { name: 'minTenorMonths', type: 'number', defaultValue: 36 },
    { name: 'minPartialPrepayment', type: 'number', defaultValue: 6 }, // x angsuran
  ],
};
```

### 3.3 KprRateTiers

```typescript
export const KprRateTiers: CollectionConfig = {
  slug: 'kpr-rate-tiers',
  admin: { group: 'KPR' },
  fields: [
    { name: 'loan', type: 'relationship', relationTo: 'kpr-loans', required: true },
    { name: 'tierOrder', type: 'number', required: true },
    { name: 'startMonth', type: 'number', required: true },
    { name: 'endMonth', type: 'number', required: true },
    { name: 'ratePct', type: 'number', required: true }, // 4.75, 8.00, 10.25
    { name: 'installment', type: 'number', required: true }, // 2681900, 3367400, 3815600
  ],
};
```

### 3.4 KprSchedule

```typescript
export const KprSchedule: CollectionConfig = {
  slug: 'kpr-schedule',
  admin: { group: 'KPR' },
  fields: [
    { name: 'loan', type: 'relationship', relationTo: 'kpr-loans', required: true },
    { name: 'monthNumber', type: 'number', required: true },
    { name: 'calendarDate', type: 'date', required: true },
    { name: 'principalPortion', type: 'number', required: true },
    { name: 'interestPortion', type: 'number', required: true },
    { name: 'totalInstallment', type: 'number', required: true },
    { name: 'outstandingBalance', type: 'number', required: true },
    { name: 'interestRate', type: 'number', required: true },
    { name: 'isPaid', type: 'checkbox', defaultValue: false },
    { name: 'paidDate', type: 'date' },
    { name: 'paidAmount', type: 'number' },
    { name: 'notes', type: 'textarea' },
  ],
};
```

### 3.5 KprExtraPayments

```typescript
export const KprExtraPayments: CollectionConfig = {
  slug: 'kpr-extra-payments',
  admin: { group: 'KPR' },
  fields: [
    { name: 'loan', type: 'relationship', relationTo: 'kpr-loans', required: true },
    { name: 'paymentDate', type: 'date', required: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'note', type: 'text' },
  ],
};
```

### 3.6 KprReminders

```typescript
export const KprReminders: CollectionConfig = {
  slug: 'kpr-reminders',
  admin: { group: 'KPR' },
  fields: [
    { name: 'loan', type: 'relationship', relationTo: 'kpr-loans', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'reminderDay', type: 'number', required: true, min: 1, max: 28 },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
    { name: 'lastSentAt', type: 'date' },
  ],
};
```

### 3.7 KprSimulations

```typescript
export const KprSimulations: CollectionConfig = {
  slug: 'kpr-simulations',
  admin: { group: 'KPR' },
  fields: [
    { name: 'loan', type: 'relationship', relationTo: 'kpr-loans', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'scenarioType', type: 'select', options: [
      { label: 'Early Full Payoff', value: 'early_payoff' },
      { label: 'Extra Payment', value: 'extra_payment' },
      { label: 'Refinance', value: 'refinance' },
    ]},
    { name: 'params', type: 'json', required: true },
    { name: 'results', type: 'json', required: true },
  ],
};
```

---

## 4. Custom Endpoints (Payload Endpoints API)

Payload CMS mendukung custom endpoints via `endpoints` config di `payload.config.ts`:

```typescript
// apps/cms/src/payload.config.ts
export default buildConfig({
  // ... existing config
  endpoints: [
    // Current KPR status (computed)
    {
      path: '/kpr/status',
      method: 'get',
      handler: async (req) => { /* ... */ },
    },
    // Run simulation
    {
      path: '/kpr/simulate/early-payoff',
      method: 'post',
      handler: async (req) => { /* ... */ },
    },
    {
      path: '/kpr/simulate/extra-payment',
      method: 'post',
      handler: async (req) => { /* ... */ },
    },
    // Financial insights
    {
      path: '/kpr/insights',
      method: 'get',
      handler: async (req) => { /* ... */ },
    },
    // Trigger email reminder
    {
      path: '/kpr/send-reminder',
      method: 'post',
      handler: async (req) => { /* ... */ },
    },
    // Seed data from CSV
    {
      path: '/kpr/seed',
      method: 'post',
      handler: async (req) => { /* ... */ },
    },
  ],
});
```

---

## 5. Features

### 5.1 Dashboard (Route: /)

**Summary Cards:**
- Total Pinjaman: Rp 415,000,000
- Sisa Pokok: Rp 378,443,227 (computed from schedule)
- Total Bunga Dibayar: Rp 56,425,862 (computed)
- Progress: 8.8% terbayar
- Angsuran Bulan Ini: Rp 2,681,900
- Bunga Aktif: 4.75% (Fase 1)

**Visual Elements:**
- Progress bar segmented per fase bunga
- Countdown ke fase berikutnya
- Donut chart: pokok vs bunga yang sudah dibayar
- Area chart: outstanding balance over time

### 5.2 Tabel Angsuran (Route: /schedule)

**TanStack Table:**
- 240 rows dengan kolom: Bulan, Tanggal, Pokok, Bunga, Total, Saldo, Rate, Status
- Row highlighting: bulan berjalan (current), fase bunga (color coded)
- Sort, filter, column visibility toggle
- Toggle "is_paid" per row (checkbox)
- Bulk mark: "Tandai semua sampai bulan X"
- Virtual scrolling atau pagination

**Charts:**
- Stacked area: pokok vs bunga per bulan
- Line: outstanding balance
- Bar: bunga vs pokok per tahun

### 5.3 Payment Simulator (Route: /simulator)

**Tab 1: Early Full Payoff**
- Slider/input: target bulan pelunasan (1-240)
- Computed output:
  - Sisa pokok di bulan tsb
  - Penalti (10% atau 2.5%)
  - Total ke bank
  - Grand total cost
  - Hemat vs tenor penuh
  - Break-even penalti

**Tab 2: Extra Payment**
- Input: nominal extra per bulan, mulai bulan ke-
- Computed output:
  - Tenor baru (lebih cepat X bulan)
  - Bunga yang dihemat
  - Side-by-side chart vs original

**Tab 3: Comparison**
- Tabel perbandingan semua skenario tersimpan
- Highlight skenario terbaik

### 5.4 Financial Insights (Route: /insights)

**Opportunity Cost Table:**
| Instrumen | Return | vs Bunga KPR | Verdict |
|-----------|--------|--------------|---------|
| Deposito | 5.2% | vs 4.75% | KPR lebih murah |
| Obligasi ORI | 6.5% | vs 4.75% | KPR lebih murah |
| Reksadana | 10% | vs 10.25% | Sebanding |

**Milestones:**
- "3 bulan lagi bunga naik ke 8%"
- "Penalti pelunasan sudah turun ke 2.5%"
- "Anda sudah membayar 25% pokok"

**Recommendations:**
- Kapan waktu terbaik melunasi
- Strategi optimal berdasarkan posisi saat ini

### 5.5 Settings (Route: /settings)

- Edit data KPR
- Kelola rate tiers
- Konfigurasi email reminder
- Manual bulk mark payments
- Export CSV

### 5.6 Email Reminders

**Flow:**
1. User konfigurasi reminder di Settings (email, hari)
2. Payload cron job / scheduled task check setiap hari
3. Jika hari ini = reminder day, kirim email via Nodemailer (Google SMTP)
4. Email content: angsuran bulan ini, sisa pokok, progress, insight

---

## 6. Auth Strategy

**Payload CMS Built-in Auth:**
- JWT-based authentication
- API key support (untuk frontend SPA)
- Admin panel login di `/admin`
- Single user: satu akun Users saja

**Frontend Auth Flow:**
1. User login via `/admin` (Payload admin panel)
2. Atau: Frontend SPA punya login page sendiri yang panggil Payload REST API
3. JWT token disimpan di localStorage/cookie
4. Semua API calls menyertakan Bearer token

**Recommendation:** Gunakan Payload admin panel untuk manage data (CRUD), dan frontend SPA untuk view/analyze data. Auth di SPA menggunakan Payload's REST auth endpoint.

---

## 7. Tech Stack (Final)

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + Vite | 19.x / 6.x |
| **Routing** | TanStack Router | latest |
| **Data Fetching** | TanStack Query | latest |
| **Data Tables** | TanStack Table | latest |
| **Styling** | TailwindCSS + shadcn/ui | 4.x |
| **Charts** | Recharts | latest |
| **Backend (CMS)** | Payload CMS | 3.35+ |
| **Framework** | Next.js | 15.4.x |
| **Database** | MongoDB Atlas | shared cluster |
| **Email** | Nodemailer | via Google SMTP |
| **Monorepo** | Turborepo + pnpm | same as portfolio |
| **Container** | Docker + K8s | same pattern |
| **Ingress** | Traefik IngressRoute | monetalis.danipras.dev |
| **Registry** | GHCR | ghcr.io/blacknvcone/vates-monitalis |

---

## 8. Deployment

### 8.1 K8s Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monetalis
```

### 8.2 Traefik IngressRoute

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: monetalis-ingressroute
  namespace: monetalis
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`monetalis.danipras.dev`)
      kind: Rule
      services:
        - name: monetalis-web
          port: 80
    - match: Host(`monetalis.danipras.dev`) && PathPrefix(`/api`, `/admin`)
      kind: Rule
      services:
        - name: monetalis-cms
          port: 80
  tls:
    certResolver: letsencrypt
```

### 8.3 Environment Variables

```env
# CMS (Payload)
DATABASE_URI=mongodb+srv://user:***@cluster.mongodb.net/monetalis
PAYLOAD_SECRET=<generate-random>
PAYLOAD_PUBLIC_SERVER_URL=https://monetalis.danipras.dev
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=dani.prasetya@gmail.com
SMTP_PASS=<app-password>

# Web (Frontend)
VITE_API_URL=https://monetalis.danipras.dev/api
```

---

## 9. Implementation Phases

### Phase 1: Foundation
- [ ] Monorepo setup (Turborepo + pnpm)
- [ ] Payload CMS setup (collections + seed data)
- [ ] Frontend SPA skeleton (TanStack Router)
- [ ] Dashboard page with summary cards
- [ ] Auth integration

### Phase 2: Core Features
- [ ] Tabel Angsuran (TanStack Table)
- [ ] Charts & visualizations
- [ ] Payment status tracking (is_paid toggle)
- [ ] Custom endpoint: /kpr/status

### Phase 3: Simulator
- [ ] Early payoff simulator
- [ ] Extra payment simulator
- [ ] Scenario comparison
- [ ] Custom endpoints: /kpr/simulate/*

### Phase 4: Insights & Email
- [ ] Financial insights engine
- [ ] Milestone alerts
- [ ] Email reminder system (Nodemailer)
- [ ] Custom endpoints: /kpr/insights, /kpr/send-reminder

### Phase 5: Deploy
- [ ] Dockerfile (web + cms)
- [ ] K8s manifests
- [ ] CI/CD (GitHub Actions → GHCR)
- [ ] Traefik IngressRoute
- [ ] Domain setup: monetalis.danipras.dev

---

## 10. Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Auth? | ✅ Payload built-in JWT + API key |
| Multi-loan? | 🔜 Future, focus single KPR now |
| Payload CMS integration? | ✅ Payload AS backend (no separate API) |
| Database? | ✅ MongoDB Atlas (shared cluster, separate DB) |
| Domain? | ✅ monetalis.danipras.dev via Traefik |
