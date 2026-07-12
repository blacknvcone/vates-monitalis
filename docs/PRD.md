# Monetalis - KPR Financial Analysis Dashboard

## Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 12 Juli 2026
**Author:** Engineering Team
**Status:** Draft

---

## 1. Overview

### 1.1 Problem Statement

Sebagai pemilik KPR dengan struktur bunga berjenjang (stepped fixed rate), diperlukan sebuah tool yang bisa:
- Merangkum seluruh data keuangan KPR dalam satu dashboard
- Mensimulasikan skenario pembayaran (termasuk pelunasan dipercepat)
- Mengirim reminder email sebelum jatuh tempo angsuran
- Memberikan insight layaknya seorang financial analyst berpengalaman

### 1.2 Product Vision

Sebuah web application personal finance tool yang informatif, profesional, dan actionable untuk monitoring dan optimasi KPR.

### 1.3 Target User

Single-user (personal tool) dengan opsi扩展 ke multi-user di masa depan.

---

## 2. Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend Framework** | React 19 + Vite | Fast dev, optimal build |
| **Routing** | TanStack Router | Type-safe file-based routing |
| **Data Fetching** | TanStack Query | Caching, background refetch |
| **Data Tables** | TanStack Table | Powerful headless table |
| **Styling** | TailwindCSS 4 + shadcn/ui | Rapid UI, consistent design |
| **Charts** | Recharts / Nivo | Financial data visualization |
| **Backend** | Hono (Node.js) | Ultra-lightweight, edge-ready API |
| **ORM** | Drizzle ORM | Type-safe, lightweight SQL |
| **Database** | PostgreSQL | Relational data, already in K8s |
| **Email** | Nodemailer (Google SMTP) | Reliable, no extra service |
| **Validation** | Zod | Shared schema frontend + backend |
| **Monorepo** | Turborepo | Fast builds, shared packages |
| **Container** | Docker + K8s | Deployment target |

---

## 3. Architecture

```
                    ┌──────────────────┐
                    │   K8s Cluster    │
                    │                  │
  Browser ──────►  │  ┌────────────┐  │
                    │  │  web (SPA) │  │  ← Vite static build, nginx
                    │  │  port 3000 │  │
                    │  └─────┬──────┘  │
                    │        │ API calls│
                    │  ┌─────▼──────┐  │
                    │  │  api (Hono)│  │  ← Node.js runtime
                    │  │  port 4000 │  │
                    │  └──┬─────┬───┘  │
                    │     │     │      │
                    │  ┌──▼──┐ ┌▼────┐ │
                    │  │ PG  │ │SMTP │ │
                    │  │5432 │ │Google│ │
                    │  └─────┘ └─────┘ │
                    └──────────────────┘
```

### 3.1 Monorepo Structure

```
vates-monitalis/
├── apps/
│   ├── web/                    # Frontend SPA
│   │   ├── src/
│   │   │   ├── routes/         # TanStack Router file-based routes
│   │   │   ├── components/     # UI components
│   │   │   ├── features/       # Feature modules
│   │   │   │   ├── dashboard/  # Dashboard feature
│   │   │   │   ├── simulator/  # Payment simulator
│   │   │   │   ├── schedule/   # Installment schedule
│   │   │   │   └── settings/   # Settings & reminders
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utilities, API client
│   │   │   └── styles/         # Global styles
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── api/                    # Backend API
│       ├── src/
│       │   ├── routes/         # Hono route handlers
│       │   ├── services/       # Business logic
│       │   │   ├── kpr.ts      # KPR calculation engine
│       │   │   ├── simulator.ts # Simulation logic
│       │   │   └── email.ts    # Email service
│       │   ├── db/
│       │   │   ├── schema.ts   # Drizzle schema
│       │   │   ├── migrations/ # DB migrations
│       │   │   └── seed.ts     # Seed data (from CSV)
│       │   ├── jobs/           # Background jobs
│       │   │   └── reminder.ts # Cron job for email reminders
│       │   └── index.ts        # Hono app entry
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared code
│       ├── src/
│       │   ├── types/          # TypeScript types
│       │   ├── schemas/        # Zod schemas
│       │   └── utils/          # Shared utilities (currency format, etc.)
│       └── package.json
│
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yaml
│   ├── web.yaml
│   ├── api.yaml
│   ├── postgres.yaml (reference existing)
│   └── secrets.yaml
│
├── turbo.json
├── docker-compose.yaml         # Local dev
├── package.json
└── README.md
```

---

## 4. Database Schema

### 4.1 Tables

```sql
-- KPR loan metadata (single row, the main loan)
CREATE TABLE kpr_loans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_name   TEXT NOT NULL,
    co_borrower     TEXT,
    bank_name       TEXT NOT NULL,
    branch          TEXT,
    loan_amount     BIGINT NOT NULL,           -- 415000000
    house_price     BIGINT NOT NULL,           -- 539000000
    down_payment    BIGINT NOT NULL,           -- 124000000
    tenor_months    INT NOT NULL,              -- 240
    first_payment   DATE NOT NULL,             -- 2023-11-01
    offering_letter TEXT,                      -- reference number
    property_address TEXT,
    certificate_no  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Interest rate tiers
CREATE TABLE kpr_rate_tiers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id     UUID REFERENCES kpr_loans(id),
    tier_order  INT NOT NULL,                  -- 1, 2, 3
    start_month INT NOT NULL,                  -- 1, 37, 73
    end_month   INT NOT NULL,                  -- 36, 72, 240
    rate_pct    DECIMAL(5,2) NOT NULL,         -- 4.75, 8.00, 10.25
    installment BIGINT NOT NULL                -- 2681900, 3367400, 3815600
);

-- Full amortization schedule (from CSV, pre-computed)
CREATE TABLE kpr_schedule (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id         UUID REFERENCES kpr_loans(id),
    month_number    INT NOT NULL,              -- 1-240
    calendar_date   DATE NOT NULL,             -- 2023-11-01
    principal_portion   BIGINT NOT NULL,
    interest_portion    BIGINT NOT NULL,
    total_installment   BIGINT NOT NULL,
    outstanding_balance BIGINT NOT NULL,
    interest_rate   DECIMAL(5,2) NOT NULL,
    is_paid         BOOLEAN DEFAULT FALSE,
    paid_date       DATE,
    paid_amount     BIGINT,
    UNIQUE(loan_id, month_number)
);

-- Extra payments / partial prepayments
CREATE TABLE kpr_extra_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id         UUID REFERENCES kpr_loans(id),
    payment_date    DATE NOT NULL,
    amount          BIGINT NOT NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Email reminder configuration
CREATE TABLE kpr_reminders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id         UUID REFERENCES kpr_loans(id),
    email           TEXT NOT NULL,
    reminder_day    INT NOT NULL,              -- day of month (e.g., 25 = 25th)
    is_active       BOOLEAN DEFAULT TRUE,
    last_sent_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Simulation snapshots (saved simulations)
CREATE TABLE kpr_simulations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id         UUID REFERENCES kpr_loans(id),
    name            TEXT NOT NULL,             -- "Lunasi Okt 2026", "Bayar ekstra 5jt/bln"
    scenario_type   TEXT NOT NULL,             -- 'early_payoff', 'extra_payment', 'refinance'
    params          JSONB NOT NULL,            -- scenario parameters
    results         JSONB NOT NULL,            -- computed results
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Seed Data

Data dari `KPR-Tabel-Angsuran.csv` akan di-seed ke tabel `kpr_schedule` saat pertama kali deploy.

---

## 5. Features

### 5.1 Dashboard (Home)

**Purpose:** Overview seluruh status KPR dalam satu halaman.

**Components:**
- **KPR Summary Cards**
  - Total pinjaman, sisa pokok, total bunga dibayar, persentase terbayar
  - Angsuran bulan ini, tanggal jatuh tempo
  - Bunga aktif saat ini, fase bunga berikutnya

- **Amortization Progress Bar**
  - Visual progress bar: pokok terbayar vs total
  - Breakdown: pokok vs bunga yang sudah dibayar

- **Payment Timeline**
  - Visual timeline 3 fase bunga (4.75% → 8.00% → 10.25%)
  - Marker posisi saat ini
  - Countdown ke fase berikutnya

- **Key Metrics**
  - Total biaya 20 tahun vs sudah dibayar
  - Rasio bunga/pokok
  - Estimasi sisa tenor
  - Estimasi total bunga yang akan dibayar jika lanjut sampai lunas

- **Next Payment Card**
  - Angsuran berikutnya: nominal, tanggal
  - Breakdown pokok vs bunga
  - Sisa pokok setelah pembayaran

### 5.2 Installment Schedule (Tabel Angsuran)

**Purpose:** Tabel interaktif seluruh 240 bulan angsuran.

**Components:**
- **TanStack Table** dengan:
  - Kolom: Bulan, Tanggal, Pokok, Bunga, Total, Saldo, Rate, Status
  - Sort, filter, search
  - Column visibility toggle
  - Pagination (opsional, atau virtual scrolling untuk 240 rows)
  - Row highlighting: bulan berjalan, fase bunga
  - Export CSV

- **Visual Charts**
  - Stacked area chart: pokok vs bunga per bulan
  - Line chart: outstanding balance over time
  - Bar chart: bunga vs pokok per tahun

- **Payment Status**
  - Toggle/set kolom "is_paid" per bulan
  - Bulk mark: "tandai semua sampai bulan X sebagai lunas"
  - Catatan pembayaran (jika ada keterlambatan, extra payment)

### 5.3 Payment Simulator

**Purpose:** Simulasi skenario pembayaran dan pelunasan dipercepat.

**Scenarios:**

#### 5.3.1 Early Full Payoff
- Input: target bulan pelunasan (dropdown/slider)
- Output:
  - Sisa pokok di bulan tsb
  - Penalti pelunasan (10% atau 2.5% tergantung tenor)
  - Total yang harus dibayar ke bank
  - Grand total cost (angsuran sudah dibayar + pelunasan)
  - Hemat vs tenor penuh (Rp dan %)
  - Break-even penalti (berapa bulan)

#### 5.3.2 Extra Payment Simulation
- Input: nominal extra per bulan, mulai bulan ke-
- Output:
  - Tenor baru (berapa bulan lebih cepat lunas)
  - Total bunga yang dihemat
  - Amortization schedule baru (side by side vs original)
  - Perbandingan grafik

#### 5.3.3 Refinance Simulation
- Input: bunga baru, tenor baru
- Output:
  - Angsuran baru
  - Total bunga baru vs lama
  - Break-even point

#### 5.3.4 Comparison Table
- Side-by-side comparison semua skenario
- Highlight skenario terbaik
- Export hasil simulasi

### 5.4 Financial Insights

**Purpose:** Analisa dan advice otomatis (seperti financial analyst).

**Components:**
- **Opportunity Cost Analysis**
  - Bunga KPR vs instrumen investasi (deposito, obligasi, reksadana)
  - Grafik perbandingan return

- **Optimal Payoff Window**
  - Kapan waktu terbaik melunasi
  - Mengingat struktur bunga berjenjang

- **Cash Flow Projection**
  - Proyeksi pengeluaran KPR per tahun
  - Total biaya per fase bunga

- **Milestone Alerts**
  - "3 bulan lagi bunga naik ke 8%"
  - "Anda sudah membayar 50% dari pokok"
  - "Penalti pelunasan sudah turun ke 2.5%"

### 5.5 Email Reminders

**Purpose:** Reminder otomatis sebelum jatuh tempo.

**Features:**
- Konfigurasi email penerima
- Pilih hari reminder (X hari sebelum jatuh tempo)
- Email content:
  - Angsuran bulan ini (nominal, breakdown pokok/bunga)
  - Sisa pokok setelah pembayaran
  - Progress pembayaran (% terbayar)
  - Milestone/insight bulan ini
- Test email button
- Log pengiriman (sukses/gagal)

### 5.6 Settings

**Purpose:** Konfigurasi aplikasi.

**Features:**
- Edit data KPR (jika ada perubahan dari bank)
- Kelola rate tiers
- Tandai pembayaran sudah dilakukan (manual atau bulk)
- Konfigurasi email reminder
- Export semua data (CSV/JSON)
- Dark mode toggle

---

## 6. API Design

### 6.1 Endpoints

```
Base URL: /api/v1

# KPR Loan
GET    /kpr/loan                    # Get loan metadata
PUT    /kpr/loan                    # Update loan metadata

# Rate Tiers
GET    /kpr/rates                   # Get all rate tiers

# Schedule
GET    /kpr/schedule                # Get full schedule
GET    /kpr/schedule?month=33       # Get specific month
PATCH  /kpr/schedule/:month/mark-paid  # Mark month as paid
PATCH  /kpr/schedule/bulk-mark-paid    # Bulk mark as paid

# Current Status
GET    /kpr/status                  # Current status (month, balance, etc.)

# Extra Payments
GET    /kpr/extra-payments          # List extra payments
POST   /kpr/extra-payments          # Record extra payment
DELETE /kpr/extra-payments/:id      # Remove extra payment

# Simulations
GET    /simulations                 # List saved simulations
POST   /simulations                 # Run & save simulation
GET    /simulations/:id             # Get simulation result
DELETE /simulations/:id             # Delete simulation

POST   /simulations/early-payoff    # Run early payoff simulation
POST   /simulations/extra-payment   # Run extra payment simulation

# Reminders
GET    /reminders                   # List reminders
POST   /reminders                   # Create reminder
PUT    /reminders/:id               # Update reminder
DELETE /reminders/:id               # Delete reminder
POST   /reminders/:id/test          # Send test email

# Insights
GET    /insights                    # Get financial insights
GET    /insights/opportunity-cost   # Opportunity cost analysis
GET    /insights/milestones         # Upcoming milestones

# Export
GET    /export/schedule.csv         # Export schedule as CSV
GET    /export/report.pdf           # Export full report (future)
```

### 6.2 Response Format

```typescript
// Standard API response
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    // pagination if applicable
  };
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 7. Shared Types (packages/shared)

```typescript
// Core KPR types
interface KprLoan {
  id: string;
  borrowerName: string;
  coBorrower?: string;
  bankName: string;
  branch?: string;
  loanAmount: number;
  housePrice: number;
  downPayment: number;
  tenorMonths: number;
  firstPayment: string; // ISO date
  offeringLetter?: string;
  propertyAddress?: string;
  certificateNo?: string;
}

interface RateTier {
  tierOrder: number;
  startMonth: number;
  endMonth: number;
  ratePct: number;
  installment: number;
}

interface ScheduleEntry {
  monthNumber: number;
  calendarDate: string;
  principalPortion: number;
  interestPortion: number;
  totalInstallment: number;
  outstandingBalance: number;
  interestRate: number;
  isPaid: boolean;
  paidDate?: string;
  paidAmount?: number;
}

// Simulation types
interface EarlyPayoffInput {
  targetMonth: number;
}

interface EarlyPayoffResult {
  targetMonth: number;
  calendarDate: string;
  outstandingPrincipal: number;
  penaltyRate: number;        // 10% or 2.5%
  penaltyAmount: number;
  totalToPayBank: number;
  alreadyPaid: number;
  grandTotal: number;
  savingsVsFull: number;
  savingsPct: number;
  breakEvenMonths: number;
  currentInterestRate: number;
  monthlyInterestSaved: number;
}

interface ExtraPaymentInput {
  monthlyExtra: number;
  startMonth: number;
}

interface ExtraPaymentResult {
  originalTenor: number;
  newTenor: number;
  monthsSaved: number;
  totalInterestOriginal: number;
  totalInterestNew: number;
  interestSaved: number;
  newSchedule: ScheduleEntry[];
}

// Reminder types
interface Reminder {
  id: string;
  email: string;
  reminderDay: number;   // day of month
  isActive: boolean;
  lastSentAt?: string;
}

// Insight types
interface Milestone {
  type: 'rate_change' | 'payoff_opportunity' | 'percentage_reached' | 'penalty_change';
  date: string;
  title: string;
  description: string;
  urgency: 'info' | 'warning' | 'critical';
}

interface OpportunityCostRow {
  instrument: string;
  annualReturn: number;
  vsKprRate: number;
  verdict: 'lebih_murah' | 'sebanding' | 'lebih_mahal';
}

// Current status
interface KprStatus {
  currentMonth: number;
  currentDate: string;
  currentRate: number;
  currentInstallment: number;
  outstandingBalance: number;
  totalPaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  pctPaid: number;
  monthsRemaining: number;
  nextPaymentDate: string;
  nextPaymentAmount: number;
  nextPaymentPrincipal: number;
  nextPaymentInterest: number;
  nextBalanceAfter: number;
  currentPhase: number;
  nextPhaseMonth?: number;
  nextPhaseRate?: number;
  monthsUntilNextPhase?: number;
}
```

---

## 8. Frontend Routes (TanStack Router)

```
/                           → Dashboard (home)
/schedule                   → Tabel Angsuran (TanStack Table)
/simulator                  → Payment Simulator
  /simulator/early-payoff   → Early Payoff Simulator
  /simulator/extra-payment  → Extra Payment Simulator
  /simulator/compare        → Scenario Comparison
/insights                   → Financial Insights
/settings                   → Settings
  /settings/reminders       → Email Reminder Config
  /settings/loan            → Edit Loan Data
```

---

## 9. UI Design Guidelines

### 9.1 Design Principles
- **Professional**: Terlihat seperti dashboard fintech profesional
- **Informatif**: Setiap angka punya konteks dan makna
- **Actionable**: User tahu apa yang harus dilakukan
- **Clean**: Tidak cluttered, whitespace cukup

### 9.2 Color System
- **Primary**: Deep blue (#1e3a5f) - trust, stability
- **Success**: Green (#22c55e) - paid, savings
- **Warning**: Amber (#f59e0b) - rate change coming
- **Danger**: Red (#ef4444) - penalty, high interest
- **Neutral**: Slate grays

### 9.3 Key UI Components
- **Summary Cards**: Large number + context + trend indicator
- **Progress Bars**: Animated, segmented by phase
- **Data Tables**: TanStack Table with sticky headers, row highlighting
- **Charts**: Responsive, interactive tooltips
- **Simulation Panel**: Side-by-side comparison layout

### 9.4 Responsive
- Mobile-first, desktop-optimized
- Sidebar navigation on desktop, bottom nav on mobile

---

## 10. Email Template

### 10.1 Monthly Reminder Email

```
Subject: 🔔 Angsuran KPR Bulan {{month}} - Rp {{amount}}

Body:
- Header: Logo + "Monetalis KPR Reminder"
- Greeting: "Halo {{name}},"

- Card: Angsuran Bulan Ini
  - Total: Rp {{amount}}
  - Pokok: Rp {{principal}}
  - Bunga: Rp {{interest}}
  - Jatuh Tempo: {{due_date}}

- Card: Status KPR
  - Sisa Pokok: Rp {{balance_after}}
  - Progress: {{pct_paid}}% terbayar
  - Fase Bunga: {{current_rate}}% ({{phase_name}})

- Section: Insight Bulan Ini
  - {{dynamic_insight}} (e.g., "3 bulan lagi bunga naik ke 8%")

- CTA: "Lihat Dashboard →" (link ke app)

- Footer: Monetalis - KPR Financial Dashboard
```

---

## 11. Deployment

### 11.1 Docker Images

**web (Frontend)**
```dockerfile
# Multi-stage: build Vite app, serve with nginx
FROM node:22-alpine AS build
# ... build steps ...
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

**api (Backend)**
```dockerfile
FROM node:22-alpine
# ... install deps, build ...
CMD ["node", "dist/index.js"]
```

### 11.2 K8s Manifests

```yaml
# Deployment: web (1 replica)
# Deployment: api (1 replica)
# Service: web (ClusterIP)
# Service: api (ClusterIP)
# Ingress: monetalis.example.com → web
#          monetalis.example.com/api → api
# ConfigMap: api config (DB URL, SMTP settings)
# Secret: DB password, SMTP password
# CronJob: email reminder check (daily)
```

### 11.3 Environment Variables

```env
# API
DATABASE_URL=postgresql://user:pass@postgres:5432/monetalis
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app-password
APP_URL=https://monetalis.example.com

# Web
VITE_API_URL=/api/v1
```

---

## 12. Development Phases

### Phase 1: Foundation (MVP)
- [ ] Monorepo setup (Turborepo)
- [ ] Backend: Hono API + Drizzle + PostgreSQL
- [ ] Seed data from CSV
- [ ] Frontend: TanStack Router + basic Dashboard
- [ ] Tabel Angsuran dengan TanStack Table
- [ ] Basic KPR status endpoint

### Phase 2: Simulator
- [ ] Early payoff simulator
- [ ] Extra payment simulator
- [ ] Scenario comparison
- [ ] Charts & visualizations

### Phase 3: Insights & Email
- [ ] Financial insights engine
- [ ] Milestone alerts
- [ ] Email reminder system (Nodemailer + Google SMTP)
- [ ] Email templates
- [ ] Cron job for daily reminder check

### Phase 4: Polish & Deploy
- [ ] Responsive design
- [ ] Dark mode
- [ ] Export (CSV)
- [ ] Docker + K8s manifests
- [ ] CI/CD pipeline
- [ ] Documentation

---

## 13. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Page Load Time | < 2s (SPA, cached) |
| API Response Time | < 200ms (p95) |
| Uptime | 99% (personal tool) |
| Browser Support | Chrome, Firefox, Safari (latest 2 versions) |
| Mobile | Responsive, touch-friendly |
| Security | API key auth (single-user), HTTPS via K8s ingress |
| Data Backup | PostgreSQL backup via K8s CronJob |

---

## 14. Open Questions

1. **Auth**: Saat ini single-user, apakah perlu login? Atau cukup network-level security (VPN/ingress restriction)?
2. **Multi-loan**: Apakah perlu support multiple KPR loans di masa depan?
3. **Payload CMS Integration**: Apakah perlu integrate dengan Payload CMS yang sudah ada?
4. **Domain**: Apa domain yang akan digunakan?
