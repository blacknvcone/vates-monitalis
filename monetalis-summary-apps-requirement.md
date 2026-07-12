# Monetalis - KPR Financial Analysis Dashboard

## Requirement Overview

### Problem
Monitoring KPR dengan struktur bunga berjenjang (stepped fixed rate) membutuhkan tool yang bisa merangkum data keuangan, mensimulasikan skenario pembayaran, dan mengirim reminder otomatis.

### Solution
Web application personal finance dashboard yang informatif dan profesional.

---

## Functional Requirements

### 1. Dashboard Summary
- Merender semua data summary keuangan KPR
- Sisa pokok, total bunga dibayar, progress pembayaran
- Angsuran bulan ini dan jadwal berikutnya
- Fase bunga aktif dan countdown ke fase berikutnya
- Key metrics: total cost, rasio bunga/pokok, estimasi sisa tenor

### 2. Tabel Angsuran Interaktif
- 240 baris data angsuran dengan TanStack Table
- Sort, filter, search, column visibility
- Tandai pembayaran sudah dilakukan
- Visualisasi grafik (area chart, line chart)

### 3. Payment Simulator
- **Early Payoff**: Hitung penalti, total cost, hemat vs tenor penuh
- **Extra Payment**: Simulasi bayar ekstra per bulan, hitung tenor baru
- **Scenario Comparison**: Side-by-side perbandingan skenario
- Break-even analysis otomatis

### 4. Financial Insights
- Analisa opportunity cost (KPR vs investasi)
- Milestone alerts (perubahan bunga, pencapaian %)
- Rekomendasi otomatis kapan waktu terbaik melunasi

### 5. Email Reminder
- Konfigurasi email penerima dan hari reminder
- Email template profesional dengan data angsuran bulan ini
- Test email button
- Log pengiriman

### 6. Settings
- Edit data KPR dan rate tiers
- Konfigurasi reminder
- Export data (CSV)

---

## Technical Requirements

### Stack
- **Frontend**: React + Vite + TanStack (Router, Query, Table) + TailwindCSS + shadcn/ui
- **Backend**: Hono (Node.js API)
- **Database**: PostgreSQL (existing K8s)
- **Email**: Nodemailer via Google SMTP
- **Monorepo**: Turborepo
- **Deploy**: Docker + K8s

### Architecture
```
Browser → [web:3000] → [api:4000] → [PostgreSQL:5432]
                                    → [Google SMTP]
```

### Data Model
- `kpr_loans` - Metadata pinjaman
- `kpr_rate_tiers` - Tier suku bunga
- `kpr_schedule` - Jadwal angsuran 240 bulan
- `kpr_extra_payments` - Pembayaran ekstra
- `kpr_reminders` - Konfigurasi email reminder
- `kpr_simulations` - Skenario simulasi tersimpan

### Deployment
- 2 containers: web (nginx + static) + api (Node.js)
- K8s: Deployment + Service + Ingress + ConfigMap + Secret
- CronJob untuk daily reminder check

---

## Implementation Phases

| Phase | Scope | Est. Effort |
|-------|-------|-------------|
| 1. Foundation | Monorepo, DB, API, Dashboard, Tabel | 2-3 days |
| 2. Simulator | Early payoff, extra payment, charts | 1-2 days |
| 3. Insights & Email | Insights engine, email reminders | 1-2 days |
| 4. Polish & Deploy | Responsive, dark mode, Docker, K8s | 1-2 days |

---

## Detail

Full PRD: [docs/PRD.md](docs/PRD.md)
