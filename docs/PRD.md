# Monetalis - KPR Financial Analysis Dashboard

## Product Requirements Document (PRD)

**Version:** 5.0 (MVP Complete)
**Date:** 12 Juli 2026
**Status:** ✅ Implemented

---

## 1. Overview

Web application personal finance dashboard untuk monitoring dan optimasi KPR BRI dengan struktur bunga berjenjang.

- **Frontend**: React SPA dengan TanStack (Router + Query + Table)
- **Backend**: Shared Payload CMS 3.x (repository: `revamp-portfolio`)
- **Database**: MongoDB Atlas
- **Domain**: monetalis.danipras.dev

---

## 2. Implementation Status

### ✅ CMS Collections (revamp-portfolio)

| Collection | File | Description |
|-----------|------|-------------|
| `monetalis-users` | `MonetalisUsers.ts` | Auth users, linked to 1 loan, role: admin/viewer |
| `kpr-loans` | `KprLoans.ts` | Loan metadata (3 tabs) |
| `kpr-rate-tiers` | `KprRateTiers.ts` | Stepped fixed rate tiers |
| `kpr-schedule` | `KprSchedule.ts` | 240-month schedule with payment tracking |
| `kpr-extra-payments` | `KprExtraPayments.ts` | Extra payment log |
| `kpr-reminders` | `KprReminders.ts` | Email reminder config |
| `kpr-simulations` | `KprSimulations.ts` | Saved simulations |

### ✅ CMS Custom Endpoints (revamp-portfolio)

| Endpoint | File | Description |
|----------|------|-------------|
| `GET /api/kpr/status` | `kpr.ts` | Current KPR status |
| `POST /api/kpr/simulate/early-payoff` | `kpr.ts` | Early payoff simulation |
| `POST /api/kpr/simulate/extra-payment` | `kpr.ts` | Extra payment simulation |
| `GET /api/kpr/insights` | `kpr.ts` | Financial insights |
| `POST /api/kpr/seed` | `kpr.ts` | Seed data (marks paid entries) |
| `POST /api/kpr/send-payment-reminder` | `kpr-email.ts` | Send to all loan users |
| `POST /api/kpr/send-monthly-insight` | `kpr-email.ts` | Send to all loan users |
| `POST /api/kpr/send-payment-reminder-test` | `kpr-email.ts` | Send to specific email |
| `POST /api/kpr/send-monthly-insight-test` | `kpr-email.ts` | Send to specific email |

### ✅ Frontend (vates-monitalis)

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/` | Summary cards, phase timeline, balance chart, pie chart, next payment, milestone alerts |
| Tabel Angsuran | `/schedule` | TanStack Table 240 rows, sort, filter, pagination, status toggle, area chart |
| Simulator | `/simulator` | 3 tabs: early payoff, extra payment, savings simulation |
| Insights | `/insights` | Computed: key metrics, recommendation, milestones, opportunity cost table |
| Settings | `/settings` | Reminder config (day, types), users list with test email, loan info, export |
| Login | `/login` | Auth form with email/password |

### ✅ Supporting Code

| File | Lines | Description |
|------|-------|-------------|
| `lib/api.ts` | 260+ | Payload CMS REST client (full CRUD + custom endpoints) |
| `lib/auth.tsx` | 70 | AuthContext provider + useAuth hook |
| `lib/mock-data.ts` | 350+ | Mock data generator with savings simulation |
| `lib/format.ts` | 90 | IDR currency, date, percentage formatters |
| `hooks/index.ts` | 180 | TanStack Query hooks (auto loanId) |
| `types/index.ts` | 170 | TypeScript interfaces |

---

## 3. Key Architecture Decisions

1. **Shared CMS** — Payload CMS serves multiple frontends (portfolio + monetalis)
2. **User-Loan Relationship** — 1 user → 1 loan, 1 loan → N users
3. **Auth** — MonetalisUsers collection with JWT, separate from shared Users
4. **Email** — Nodemailer via Google SMTP, sends to all users on a loan
5. **Data Isolation** — Users only see data for their assigned loanId

---

## 4. Email System

| Type | Subject | Content |
|------|---------|---------|
| Payment Reminder | 🔔 Pengingat Angsuran KPR - [Month] | Next payment, due date, breakdown, progress |
| Monthly Insight | 📊 Laporan Bulanan KPR - [Month] | Summary, accumulation, milestones, recommendations |

- Multi-recipient: all active users linked to the loan
- Configurable: day of month (1-28), toggle per type
- Per-user test buttons in frontend Settings

---

## 5. Deployment

| Component | Repository | CI/CD | Domain |
|-----------|-----------|-------|--------|
| Frontend | vates-monitalis | GitHub Actions (`v*` tag) | monetalis.danipras.dev |
| CMS | revamp-portfolio | GitHub Actions (`cms-v*` tag) | cms.danipras.dev |
| K8s Manifests | obelix | Manual apply | - |

---

## 6. KPR Data

| Item | Value |
|------|-------|
| Borrower | Fachrul Dani Prasetya & Nur Winingsih |
| Bank | BRI Kanca HR Muhammad |
| Loan Amount | Rp 415,000,000 |
| House Price | Rp 539,000,000 |
| Down Payment | Rp 124,000,000 (23%) |
| Tenor | 240 months (20 years) |
| First Payment | November 2023 |

| Phase | Months | Rate | Installment |
|-------|--------|------|-------------|
| 1 | 1-36 (Nov 2023 - Okt 2026) | 4.75% | Rp 2,681,900 |
| 2 | 37-72 (Nov 2026 - Okt 2029) | 8.00% | Rp 3,367,400 |
| 3 | 73-240 (Nov 2029 - Okt 2043) | 10.25% | Rp 3,815,600 |

**Total bunga 20 tahun:** Rp 443,782,131 (107% dari pokok)
