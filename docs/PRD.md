# Monetalis - KPR Financial Analysis Dashboard

## Product Requirements Document (PRD)

**Version:** 3.0 (Shared CMS Architecture)
**Date:** 12 Juli 2026
**Status:** Ready for Implementation

---

## 1. Overview

### 1.1 Problem Statement

Monitoring KPR dengan struktur bunga berjenjang (stepped fixed rate) membutuhkan tool yang bisa merangkum data keuangan, mensimulasikan skenario pembayaran, dan mengirim reminder otomatis.

### 1.2 Solution

Web application personal finance dashboard:
- **Frontend**: Standalone React SPA dengan TanStack (Router + Query + Table)
- **Backend**: Shared Payload CMS 3.x (sudah ada di `revamp-portfolio`)
- **Database**: MongoDB Atlas (shared cluster, database yang sama)
- **Email**: Nodemailer via Google SMTP (custom endpoint di CMS)

### 1.3 Key Architecture Decision

> **Shared CMS** — Payload CMS yang sudah ada di `revamp-portfolio/apps/cms/`
> digunakan sebagai backend untuk multiple frontends (portfolio + monetalis).
> KPR collections ditambahkan dengan group `Monetalis` untuk separasi yang jelas.

---

## 2. Architecture

```
                    ┌─────────────────────────────────────┐
                    │  Shared Payload CMS                  │
                    │  (revamp-portfolio/apps/cms/)        │
                    │  cms.danipras.dev                    │
                    │                                      │
                    │  Collections:                        │
                    │  ┌─────────────────┐                │
                    │  │ Shared          │                │
                    │  │  - Users        │                │
                    │  │  - Media        │                │
                    │  ├─────────────────┤                │
                    │  │ Portfolio Web   │                │
                    │  │  - Projects     │                │
                    │  │  - Experiences  │                │
                    │  │  - Skills       │                │
                    │  │  - Educations   │                │
                    │  │  - Certifications│               │
                    │  │  - Profile (G)  │                │
                    │  ├─────────────────┤                │
                    │  │ Monetalis       │ ← NEW          │
                    │  │  - KPR Loans    │                │
                    │  │  - Rate Tiers   │                │
                    │  │  - Schedule     │                │
                    │  │  - Extra Pmts   │                │
                    │  │  - Reminders    │                │
                    │  │  - Simulations  │                │
                    │  └─────────────────┘                │
                    └──────────┬──────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼───────┐
     │ Portfolio Web   │ │ Monetalis  │ │ Future Apps   │
     │ (existing)      │ │ Web (SPA)  │ │ ...           │
     │ Next.js         │ │ Vite+React │ │               │
     └────────────────┘ └────────────┘ └───────────────┘
```

### 2.1 Repo Structure

```
revamp-portfolio/                    # Shared CMS (sudah ada)
├── apps/
│   ├── cms/                         # Payload CMS (shared backend)
│   │   └── src/
│   │       ├── collections/
│   │       │   ├── Users.ts         # Shared
│   │       │   ├── Media.ts         # Shared
│   │       │   ├── Profile.ts       # Portfolio Web
│   │       │   ├── Projects.ts      # Portfolio Web
│   │       │   ├── Experiences.ts   # Portfolio Web
│   │       │   ├── Skills.ts        # Portfolio Web
│   │       │   ├── Educations.ts    # Portfolio Web
│   │       │   ├── Certifications.ts# Portfolio Web
│   │       │   └── monetalis/       # ← NEW (subdirectory)
│   │       │       ├── index.ts
│   │       │       ├── KprLoans.ts
│   │       │       ├── KprRateTiers.ts
│   │       │       ├── KprSchedule.ts
│   │       │       ├── KprExtraPayments.ts
│   │       │       ├── KprReminders.ts
│   │       │       └── KprSimulations.ts
│   │       └── payload.config.ts    # Updated dengan monetalis imports
│   └── web/                         # Portfolio frontend (existing)
│
vates-monitalis/                     # Monetalis frontend (NEW repo)
├── src/
│   ├── routes/                      # TanStack Router
│   ├── components/
│   ├── lib/
│   │   ├── api.ts                   # Payload API client
│   │   └── auth.ts                  # Auth helpers
│   └── hooks/
├── Dockerfile
├── vite.config.ts
└── package.json
```

### 2.2 Admin Panel Grouping

Di Payload admin panel (`cms.danipras.dev/admin`), sidebar akan terlihat:

```
┌─────────────────────────┐
│ Collections             │
├─────────────────────────┤
│ Users                   │ (shared, no group)
│ Media                   │ (shared, no group)
├─────────────────────────┤
│ ▸ Portfolio Web         │
│   - Projects            │
│   - Experiences         │
│   - Skills              │
│   - Educations          │
│   - Certifications      │
├─────────────────────────┤
│ ▸ Monetalis             │ ← NEW group
│   - KPR Loans           │
│   - KPR Rate Tiers      │
│   - KPR Schedule        │
│   - KPR Extra Payments  │
│   - KPR Reminders       │
│   - KPR Simulations     │
├─────────────────────────┤
│ Globals                 │
│   - Profile             │
└─────────────────────────┘
```

---

## 3. Collections Detail

### 3.1 KprLoans (`kpr-loans`)

Metadata pinjaman KPR. Tab layout untuk organisasi field yang lebih baik.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| borrowerName | text | ✓ | Nama peminjam |
| coBorrower | text | | Co-borrower |
| bankName | text | ✓ | Nama bank (default: BRI) |
| branch | text | | Cabang |
| **Tab: Pinjaman** | | | |
| loanAmount | number | ✓ | Jumlah pinjaman (Rp) |
| housePrice | number | ✓ | Harga rumah (Rp) |
| downPayment | number | ✓ | Uang muka (Rp) |
| tenorMonths | number | ✓ | Tenor (bulan, default: 240) |
| firstPayment | date | ✓ | Tanggal pembayaran pertama |
| **Tab: Dokumen** | | | |
| offeringLetterRef | text | | No. Offering Letter |
| propertyAddress | textarea | | Alamat properti |
| certificateNo | text | | No. sertifikat |
| collateralValue | number | | Nilai pengikatan agunan (Rp) |
| **Tab: Aturan Penalti** | | | |
| penaltyBeforeMinTenor | number | | Penalti sebelum tenor min (%, default: 10) |
| penaltyAfterMinTenor | number | | Penalti setelah tenor min (%, default: 2.5) |
| minTenorMonths | number | | Tenor minimum (bulan, default: 36) |
| minPartialPrepayment | number | | Min pelunasan sebagian (x angsuran, default: 6) |

### 3.2 KprRateTiers (`kpr-rate-tiers`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| loan | relationship | ✓ | Relasi ke kpr-loans |
| tierOrder | number | ✓ | Urutan tier (1, 2, 3) |
| startMonth | number | ✓ | Mulai bulan ke- |
| endMonth | number | ✓ | Sampai bulan ke- |
| ratePct | number | ✓ | Suku bunga (% p.a.) |
| installment | number | ✓ | Angsuran per bulan (Rp) |

### 3.3 KprSchedule (`kpr-schedule`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| loan | relationship | ✓ | Relasi ke kpr-loans |
| monthNumber | number | ✓ | Bulan ke- (1-240) |
| calendarDate | date | ✓ | Tanggal jatuh tempo |
| principalPortion | number | ✓ | Angsuran pokok (Rp) |
| interestPortion | number | ✓ | Angsuran bunga (Rp) |
| totalInstallment | number | ✓ | Total angsuran (Rp) |
| outstandingBalance | number | ✓ | Saldo pinjaman (Rp) |
| interestRate | number | ✓ | Suku bunga (%) |
| **Status Pembayaran** (collapsible) | | | |
| isPaid | checkbox | | Sudah dibayar |
| paidDate | date | | Tanggal bayar |
| paidAmount | number | | Jumlah dibayar (Rp) |
| notes | textarea | | Catatan |

Index: unique(`loan`, `monthNumber`)

### 3.4 KprExtraPayments (`kpr-extra-payments`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| loan | relationship | ✓ | Relasi ke kpr-loans |
| paymentDate | date | ✓ | Tanggal pembayaran |
| amount | number | ✓ | Jumlah (Rp) |
| note | text | | Catatan |

### 3.5 KprReminders (`kpr-reminders`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| loan | relationship | ✓ | Relasi ke kpr-loans |
| email | email | ✓ | Email penerima |
| reminderDay | number | ✓ | Hari reminder (1-28) |
| isActive | checkbox | | Aktif (default: true) |
| lastSentAt | date | | Terakhir dikirim (read-only) |

### 3.6 KprSimulations (`kpr-simulations`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| loan | relationship | ✓ | Relasi ke kpr-loans |
| name | text | ✓ | Nama skenario |
| scenarioType | select | ✓ | early_payoff / extra_payment / refinance |
| params | json | ✓ | Parameter input |
| results | json | ✓ | Hasil perhitungan |

---

## 4. Custom Endpoints

Ditambahkan di `payload.config.ts` sebagai custom endpoints:

```typescript
endpoints: [
  { path: '/kpr/status', method: 'get', handler: statusHandler },
  { path: '/kpr/simulate/early-payoff', method: 'post', handler: earlyPayoffHandler },
  { path: '/kpr/simulate/extra-payment', method: 'post', handler: extraPaymentHandler },
  { path: '/kpr/insights', method: 'get', handler: insightsHandler },
  { path: '/kpr/send-reminder', method: 'post', handler: sendReminderHandler },
  { path: '/kpr/seed', method: 'post', handler: seedHandler },
]
```

---

## 5. Features

### 5.1 Dashboard (/)
- Summary cards: sisa pokok, total bunga, progress, angsuran bulan ini
- Progress bar segmented per fase bunga
- Charts: outstanding balance, bunga vs pokok
- Countdown ke fase berikutnya

### 5.2 Tabel Angsuran (/schedule)
- TanStack Table: 240 bulan, sort, filter, column visibility
- Row highlighting: bulan berjalan, fase bunga (color coded)
- Toggle is_paid per row
- Bulk mark payments
- Charts: area chart, line chart, bar chart

### 5.3 Simulator (/simulator)
- Early payoff: slider bulan, hitung penalti, hemat
- Extra payment: input nominal, hitung tenor baru
- Side-by-side comparison
- Simpan skenario ke CMS

### 5.4 Insights (/insights)
- Opportunity cost table
- Milestone alerts
- Rekomendasi otomatis

### 5.5 Settings (/settings)
- Konfigurasi reminder
- Export CSV

---

## 6. Frontend Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite 6 |
| UI | React 19 |
| Routing | TanStack Router |
| Data Fetching | TanStack Query |
| Data Tables | TanStack Table |
| Styling | TailwindCSS 4 + shadcn/ui |
| Charts | Recharts |
| Validation | Zod (shared schemas) |
| API Client | fetch + TanStack Query |

---

## 7. API Client Pattern

Frontend memanggil Payload REST API yang sudah ada:

```typescript
// lib/api.ts
const CMS_URL = import.meta.env.VITE_CMS_URL; // cms.danipras.dev

// Payload REST API auto-generated:
// GET  /api/kpr-loans          → list loans
// GET  /api/kpr-loans/:id      → single loan
// GET  /api/kpr-schedule       → list schedule entries
// PATCH /api/kpr-schedule/:id  → update (e.g., mark as paid)
// POST /api/kpr-simulate/early-payoff → custom endpoint
// etc.
```

---

## 8. Deployment

### 8.1 Monetalis Frontend (new)

```yaml
# K8s: monetalis namespace
- Deployment: monetalis-web (Vite static + nginx)
- Service: monetalis-web
- IngressRoute: monetalis.danipras.dev → monetalis-web:80
```

### 8.2 Shared CMS (existing)

Tidak ada perubahan deployment. CMS tetap di:
- `cms.danipras.dev` (existing IngressRoute)
- Namespace: `cms-payload`

CORS di CMS sudah dikonfigurasi untuk允许 monetalis domain.

---

## 9. Implementation Phases

### Phase 1: CMS Collections ✅
- [x] Create monetalis collection files
- [x] Update payload.config.ts
- [ ] Seed data from CSV

### Phase 2: Frontend Foundation
- [ ] Vite + React + TanStack setup
- [ ] API client (Payload REST)
- [ ] Auth integration
- [ ] Dashboard page

### Phase 3: Core Features
- [ ] Tabel Angsuran (TanStack Table)
- [ ] Charts & visualizations
- [ ] Payment status tracking

### Phase 4: Simulator & Insights
- [ ] Early payoff simulator
- [ ] Extra payment simulator
- [ ] Financial insights

### Phase 5: Email & Deploy
- [ ] Email reminder system
- [ ] Docker + K8s manifests
- [ ] Traefik IngressRoute
- [ ] CORS configuration
