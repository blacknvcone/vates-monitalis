# Monetalis - KPR Financial Analysis Dashboard

## Status: ✅ Implemented — Ready for Deployment

---

## Architecture

Frontend SPA (Vite + TanStack) → Shared Payload CMS 3.x (revamp-portfolio) → MongoDB Atlas

Domain: `monetalis.danipras.dev`

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TanStack (Router, Query, Table) + TailwindCSS 4 + Recharts |
| Backend | Payload CMS 3.x (shared instance, Monetalis group) |
| Database | MongoDB Atlas |
| Auth | Payload built-in JWT + API key |
| Email | Nodemailer via Google SMTP |
| Deploy | Docker + K8s + Traefik |

---

## Deliverables

### CMS (revamp-portfolio)

**Collections** (6 files in `collections/monetalis/`):
- `kpr-loans` — Metadata pinjaman (tab layout)
- `kpr-rate-tiers` — Tier suku bunga berjenjang
- `kpr-schedule` — Jadwal angsuran 240 bulan
- `kpr-extra-payments` — Log pembayaran ekstra
- `kpr-reminders` — Konfigurasi email reminder
- `kpr-simulations` — Skenario simulasi tersimpan

**Custom Endpoints** (801 baris in `endpoints/kpr.ts`):
- `GET /api/kpr/status` — Status KPR saat ini
- `POST /api/kpr/simulate/early-payoff` — Simulasi pelunasan
- `POST /api/kpr/simulate/extra-payment` — Simulasi bayar ekstra
- `GET /api/kpr/insights` — Financial insights
- `POST /api/kpr/seed` — Seed data KPR
- `POST /api/kpr/send-reminder` — Trigger email

### Frontend (vates-monitalis)

**Pages** (5 routes, ~2,400 baris total):
- Dashboard — Summary cards, charts, timeline, milestone alerts
- Tabel Angsuran — TanStack Table 240 bulan, sort, filter, status
- Simulator — Early payoff + extra payment, charts, comparison
- Insights — Opportunity cost, milestones, rekomendasi
- Settings — Email reminder CRUD, export, system info

**Supporting** (~770 baris):
- API client, mock data provider, hooks, types, formatters

---

## Deployment TODO

- [ ] Build & deploy CMS with new collections + endpoints
- [ ] Seed KPR data via `POST /api/kpr/seed`
- [ ] Dockerfile + K8s manifests for web
- [ ] Traefik IngressRoute
- [ ] CORS configuration
- [ ] Google SMTP credentials

---

## Detail

- [PRD](docs/PRD.md)
- [KPR Analysis](KPR-Analysis-Summary.md)
