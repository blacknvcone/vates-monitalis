import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  ArrowRight,
  Target,
  PiggyBank,
  Landmark,
} from 'lucide-react';
import { formatIDR, formatPct, formatMonthLabel } from '@/lib/format';
import {
  generateMockSchedule,
  getCurrentStatus,
  MOCK_LOAN,
  MOCK_PHASES,
} from '@/lib/mock-data';

// ============================================================
// Compute insights from real data
// ============================================================

interface Milestone {
  type: 'rate_change' | 'payoff_opportunity' | 'percentage_reached' | 'penalty_change';
  date: string;
  title: string;
  description: string;
  urgency: 'info' | 'warning' | 'critical';
}

interface OpportunityCostRow {
  instrument: string;
  icon: React.ElementType;
  annualReturn: number;
  description: string;
}

function computeInsights() {
  const status = getCurrentStatus();
  const schedule = generateMockSchedule();
  const loan = MOCK_LOAN;
  const phases = MOCK_PHASES;

  // Total interest over full tenor
  const totalInterestFull = schedule.reduce((sum, e) => sum + e.interestPortion, 0);
  const totalPayments = loan.loanAmount + totalInterestFull;

  // Current phase
  const currentPhase = status.currentPhase;
  const currentRate = status.currentRate;

  // Savings if close now (with 2.5% penalty after min tenor)
  const isAfterMinTenor = status.currentMonth >= loan.minTenorMonths;
  const penaltyRate = isAfterMinTenor ? loan.penaltyAfterMinTenor : loan.penaltyBeforeMinTenor;
  const penaltyAmount = Math.round(status.outstandingBalance * penaltyRate / 100);
  const totalToClose = status.outstandingBalance + penaltyAmount;
  const grandTotalIfClose = status.totalPaid + totalToClose;
  const savingsVsFull = totalPayments - grandTotalIfClose;

  // Generate milestones dynamically
  const milestones: Milestone[] = [];

  // Penalty change milestone
  if (status.currentMonth < loan.minTenorMonths) {
    const penaltyDate = formatMonthLabel(loan.minTenorMonths, loan.firstPayment);
    milestones.push({
      type: 'penalty_change',
      date: penaltyDate,
      title: 'Penalti Pelunasan Turun ke 2.5%',
      description: `Setelah bulan ke-${loan.minTenorMonths}, penalti pelunasan penuh turun dari ${loan.penaltyBeforeMinTenor}% ke ${loan.penaltyAfterMinTenor}%. Ini adalah waktu optimal untuk mulai pertimbangkan pelunasan.`,
      urgency: 'warning',
    });
  }

  // Rate change milestones
  for (const phase of phases) {
    if (phase.phase > currentPhase) {
      const rateDate = formatMonthLabel(phase.startMonth, loan.firstPayment);
      const rateChange = phase.rate - currentRate;
      milestones.push({
        type: 'rate_change',
        date: rateDate,
        title: `Bunga Naik ke ${formatPct(phase.rate)}`,
        description: `Fase ${phase.phase} dimulai. Angsuran naik dari ${formatIDR(status.currentInstallment)} menjadi ${formatIDR(phase.installment)}/bulan (+${formatIDR(phase.installment - status.currentInstallment)}).`,
        urgency: phase.rate >= 10 ? 'critical' : 'warning',
      });
    }
  }

  // Optimal payoff window
  if (status.currentMonth < loan.minTenorMonths) {
    const optimalDate = formatMonthLabel(loan.minTenorMonths, loan.firstPayment);
    milestones.push({
      type: 'payoff_opportunity',
      date: optimalDate,
      title: 'Window Pelunasan Optimal',
      description: `Lunasi setelah ${optimalDate} untuk dapat penalti 2.5%. Hemat ${formatIDR(savingsVsFull)} (${((savingsVsFull / totalPayments) * 100).toFixed(0)}%) dari total 20 tahun.`,
      urgency: 'critical',
    });
  }

  // Progress milestones (25%, 50%, 75%)
  const progressThresholds = [25, 50, 75];
  for (const threshold of progressThresholds) {
    const targetBalance = loan.loanAmount * (1 - threshold / 100);
    const entry = schedule.find((e) => e.outstandingBalance <= targetBalance);
    if (entry && entry.monthNumber > status.currentMonth) {
      const date = formatMonthLabel(entry.monthNumber, loan.firstPayment);
      milestones.push({
        type: 'percentage_reached',
        date,
        title: `${threshold}% Pokok Terbayar`,
        description: `Anda akan mencapai ${threshold}% pembayaran pokok sekitar ${date} (bulan ke-${entry.monthNumber}).`,
        urgency: 'info',
      });
    }
  }

  // Sort milestones by date
  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Opportunity cost comparison
  const opportunityCost: OpportunityCostRow[] = [
    { instrument: 'Deposito (after tax)', icon: Landmark, annualReturn: 5.2, description: 'Risiko sangat rendah, likuiditas terbatas' },
    { instrument: 'Obligasi ORI', icon: PiggyBank, annualReturn: 6.5, description: 'Risiko rendah, kupon tetap' },
    { instrument: 'Reksadana Pasar Uang', icon: TrendingUp, annualReturn: 5.8, description: 'Risiko rendah, likuiditas tinggi' },
    { instrument: 'Reksadana Campuran', icon: TrendingUp, annualReturn: 10.0, description: 'Risiko sedang, return fluktuatif' },
    { instrument: 'Saham IHSG', icon: TrendingUp, annualReturn: 12.0, description: 'Risiko tinggi, return tidak pasti' },
  ];

  // Recommendation
  let recommendation = '';
  if (status.currentMonth < loan.minTenorMonths) {
    const monthsUntil = loan.minTenorMonths - status.currentMonth;
    recommendation = `Tunggu ${monthsUntil} bulan lagi hingga penalti turun ke 2.5%, lalu lunasi. Hemat ${formatIDR(savingsVsFull)} dari total biaya 20 tahun.`;
  } else if (currentRate < 8) {
    recommendation = `Anda sudah di fase penalti 2.5%. Lunasi SEKARANG untuk hindari kenaikan bunga ke 8%. Hemat ${formatIDR(savingsVsFull)}.`;
  } else if (currentRate < 10.25) {
    recommendation = `Bunga ${formatPct(currentRate)} masih lebih rendah dari 10.25%. Prioritaskan pelunasan sebelum fase berikutnya.`;
  } else {
    recommendation = `Bunga 10.25% lebih tinggi dari hampir semua instrumen investasi risiko rendah. SANGAT DIREKOMENDASIKAN lunasi.`;
  }

  return {
    status,
    totalInterestFull,
    totalPayments,
    penaltyRate,
    penaltyAmount,
    totalToClose,
    grandTotalIfClose,
    savingsVsFull,
    milestones,
    opportunityCost,
    recommendation,
    currentRate,
    currentPhase,
  };
}

// ============================================================
// Components
// ============================================================

function KeyInsightCards({ data }: { data: ReturnType<typeof computeInsights> }) {
  const savingsPct = (data.savingsVsFull / data.totalPayments) * 100;

  const cards = [
    {
      label: 'Total Bunga 20 Tahun',
      value: formatIDR(data.totalInterestFull),
      detail: `${((data.totalInterestFull / loan_amount) * 100).toFixed(0)}% dari pokok pinjaman`,
      color: 'text-red-600',
    },
    {
      label: 'Total Biaya KPR',
      value: formatIDR(data.totalPayments),
      detail: `Pokok ${formatIDR(loan_amount)} + Bunga ${formatIDR(data.totalInterestFull)}`,
      color: 'text-gray-900',
    },
    {
      label: 'Multiplier',
      value: `${(data.totalPayments / MOCK_LOAN.housePrice).toFixed(1)}x`,
      detail: `Anda membayar ${(data.totalPayments / MOCK_LOAN.housePrice).toFixed(1)}x harga rumah`,
      color: 'text-amber-600',
    },
    {
      label: 'Hemat jika Lunasi Sekarang',
      value: formatIDR(data.savingsVsFull),
      detail: `${savingsPct.toFixed(0)}% dari total biaya 20 tahun`,
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">{item.label}</p>
          <p className={`text-xl font-bold mt-1 ${item.color}`}>{item.value}</p>
          <p className="text-[10px] text-gray-400 mt-1">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

const loan_amount = MOCK_LOAN.loanAmount;

function RecommendationPanel({ data }: { data: ReturnType<typeof computeInsights> }) {
  const isAfterMinTenor = data.status.currentMonth >= MOCK_LOAN.minTenorMonths;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
      <div className="flex items-start gap-3">
        <Target size={24} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base font-bold text-emerald-900">Rekomendasi Strategi</h3>
          <p className="text-sm text-emerald-800 mt-2">{data.recommendation}</p>

          <div className="mt-4 space-y-3">
            {!isAfterMinTenor && (
              <div className="flex items-start gap-2">
                <span className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Tunggu hingga penalti turun</p>
                  <p className="text-xs text-emerald-700">
                    Penalti {MOCK_LOAN.penaltyBeforeMinTenor}% → {MOCK_LOAN.penaltyAfterMinTenor}% setelah bulan ke-{MOCK_LOAN.minTenorMonths}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{isAfterMinTenor ? '1' : '2'}</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Lunasi sebelum fase bunga naik</p>
                <p className="text-xs text-emerald-700">
                  Bunga saat ini {formatPct(data.currentRate)} — hindari kenaikan ke fase berikutnya
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{isAfterMinTenor ? '2' : '3'}</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Alternatif: bayar ekstra berkala</p>
                <p className="text-xs text-emerald-700">
                  Min 6x angsuran ({formatIDR(MOCK_LOAN.minPartialPrepayment * data.status.currentInstallment)}) per pelunasan sebagian
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const urgencyConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle, iconColor: 'text-red-500', badge: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, iconColor: 'text-blue-500', badge: 'bg-blue-100 text-blue-700' },
  };

  const config = urgencyConfig[milestone.urgency];
  const Icon = config.icon;

  return (
    <div className={`${config.bg} ${config.border} border rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
            {milestone.date}
          </span>
          <h4 className="text-sm font-semibold text-gray-900 mt-1">{milestone.title}</h4>
          <p className="text-xs text-gray-600 mt-1">{milestone.description}</p>
        </div>
      </div>
    </div>
  );
}

function OpportunityCostTable({ rows, currentRate }: { rows: OpportunityCostRow[]; currentRate: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Opportunity Cost: KPR vs Investasi</h3>
        <p className="text-xs text-gray-500 mt-1">
          Bunga KPR aktif saat ini: <strong>{formatPct(currentRate)}</strong>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Instrumen</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Return/tahun</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">vs Bunga KPR</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = row.annualReturn - currentRate;
              return (
                <tr key={row.instrument} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <row.icon size={16} className="text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{row.instrument}</p>
                        <p className="text-[10px] text-gray-400">{row.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 font-mono">{formatPct(row.annualReturn)}</td>
                  <td className="text-right px-4 py-3 font-mono">
                    <span className={diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-500'}>
                      {diff > 0 ? '+' : ''}{formatPct(diff)}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    {diff > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                        <CheckCircle size={12} />
                        KPR lebih murah
                      </span>
                    ) : diff < 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                        <ArrowRight size={12} />
                        Lunasi KPR
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Sebanding</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalysisNote({ data }: { data: ReturnType<typeof computeInsights> }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
      <p className="font-medium text-gray-700 mb-1">Catatan Analisa</p>
      <p>
        Analisa ini berdasarkan data aktual KPR Anda: pokok {formatIDR(MOCK_LOAN.loanAmount)},
        bunga aktif {formatPct(data.currentRate)}, sisa {formatIDR(data.status.outstandingBalance)}.
        Bunga KPR fase tertinggi ({formatPct(MOCK_PHASES[MOCK_PHASES.length - 1].rate)})
        lebih tinggi dari hampir semua instrumen investasi risiko rendah-menengah di Indonesia.
      </p>
      <p className="mt-2">
        <strong>Opportunity cost</strong> = selisih antara return investasi dan bunga KPR.
        Jika return investasi {'<'} bunga KPR, uang lebih baik digunakan untuk melunasi KPR.
      </p>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function InsightsPage() {
  const data = useMemo(() => computeInsights(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Insights</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analisa keuangan KPR berdasarkan data aktual — bulan ke-{data.status.currentMonth}, bunga {formatPct(data.currentRate)}
        </p>
      </div>

      <KeyInsightCards data={data} />
      <RecommendationPanel data={data} />

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Milestone & Alert</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.milestones.map((m, i) => (
            <MilestoneCard key={i} milestone={m} />
          ))}
        </div>
      </div>

      <OpportunityCostTable rows={data.opportunityCost} currentRate={data.currentRate} />
      <AnalysisNote data={data} />
    </div>
  );
}

export const Route = createFileRoute('/insights')({
  component: InsightsPage,
});
