# Monetalis - KPR Financial Analysis Dashboard

## Status: ✅ v2.0 — CMS-Connected, Full Features

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

## Features (15 pages)
| Feature | Route | Description |
|---------|-------|-------------|
| Dashboard | `/` | Summary cards, phase timeline, balance chart, pie chart, next payment, milestones |
| Tabel Angsuran | `/schedule` | 240 bulan, TanStack Table, sort/filter/pagination, status toggle |
| Simulator | `/simulator` | 3 tab: Early Payoff, Extra Payment, Savings Simulation (phase-aware) |
| Insights | `/insights` | Key metrics, milestones, opportunity cost, recommendations (loan-data-driven) |
| Pembayaran Ekstra | `/extra-payments` | Track extra payments, add form, interest saved |
| Riwayat Pembayaran | `/payment-history` | Visual timeline, principal/interest split |
| Target Pelunasan | `/goals` | Target payoff date, progress, feasibility |
| Arus Kas | `/cashflow` | 12-month calendar, monthly outflow |
| Perbandingan Skenario | `/scenario-compare` | Compare baseline vs extra vs early payoff |
| Kalkulator Refinancing | `/refinance` | BRI vs BTN/BCA/Mandiri/BNI comparison |
| Penyesuaian Inflasi | `/inflation` | Nominal vs real value, adjustable rate |
| Export Laporan | `/export` | CSV download, printable report |
| Notifikasi | `/notifications` | Reminder history, active status |
| Email Reminder | Settings | Payment reminder + monthly insight, multi-user per loan |
| Auth | `/login` | Login page, JWT auth, data isolation per loanId |

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
