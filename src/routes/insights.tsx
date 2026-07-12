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
import { formatIDR, formatPct } from '@/lib/format';

// ============================================================
// Mock Data
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

function generateInsights() {
  const currentRate = 4.75;
  const currentMonth = 33;

  const milestones: Milestone[] = [
    {
      type: 'penalty_change',
      date: 'Oktober 2026',
      title: 'Penalti Pelunasan Turun ke 2.5%',
      description: 'Setelah bulan ke-36, penalti pelunasan penuh turun dari 10% ke 2.5%. Ini adalah waktu optimal untuk melunasi KPR.',
      urgency: 'warning',
    },
    {
      type: 'rate_change',
      date: 'November 2026',
      title: 'Bunga Naik ke 8.00%',
      description: 'Fase 2 dimulai. Angsuran naik dari Rp 2.681.900 menjadi Rp 3.367.400/bulan (+Rp 685.500).',
      urgency: 'critical',
    },
    {
      type: 'payoff_opportunity',
      date: 'Oktober 2026',
      title: 'Window Pelunasan Optimal',
      description: 'Lunasi sebelum November 2026 untuk menghindari kenaikan bunga. Hemat Rp 377.984.332 (44%) dari total 20 tahun.',
      urgency: 'critical',
    },
    {
      type: 'percentage_reached',
      date: 'Maret 2027',
      title: 'Pencapaian 15% Pokok Terbayar',
      description: 'Anda akan mencapai 15% pembayaran pokok sekitar bulan ke-42.',
      urgency: 'info',
    },
    {
      type: 'rate_change',
      date: 'November 2029',
      title: 'Bunga Naik ke 10.25%',
      description: 'Fase 3 dimulai. Angsuran naik menjadi Rp 3.815.600/bulan. Bunga ini LEBIH TINGGI dari hampir semua instrumen investasi risiko rendah.',
      urgency: 'critical',
    },
    {
      type: 'payoff_opportunity',
      date: 'Kapan saja setelah Nov 2026',
      title: 'Pelunasan Sebagian Minimum: 6x Angsuran',
      description: 'Anda bisa melakukan pelunasan sebagian minimum Rp 16.091.400 (6x angsuran fase 1) kapan saja setelah tahun ke-1.',
      urgency: 'info',
    },
  ];

  const opportunityCost: OpportunityCostRow[] = [
    { instrument: 'Deposito (after tax)', icon: Landmark, annualReturn: 5.2, description: 'Risiko sangat rendah, likuiditas terbatas' },
    { instrument: 'Obligasi ORI', icon: PiggyBank, annualReturn: 6.5, description: 'Risiko rendah, kupon tetap' },
    { instrument: 'Reksadana Pasar Uang', icon: TrendingUp, annualReturn: 5.8, description: 'Risiko rendah, likuiditas tinggi' },
    { instrument: 'Reksadana Campuran', icon: TrendingUp, annualReturn: 10.0, description: 'Risiko sedang, return fluktuatif' },
    { instrument: 'Saham IHSG', icon: TrendingUp, annualReturn: 12.0, description: 'Risiko tinggi, return tidak pasti' },
  ];

  return { milestones, opportunityCost, currentRate, currentMonth };
}

// ============================================================
// Components
// ============================================================

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
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
              {milestone.date}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-gray-900">{milestone.title}</h4>
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
          Perbandingan bunga KPR Anda dengan instrumen investasi umum di Indonesia
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
              const isKprCheaper = diff > 0;
              const isKprExpensive = diff < 0;

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
                    {isKprCheaper && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                        <CheckCircle size={12} />
                        KPR lebih murah
                      </span>
                    )}
                    {isKprExpensive && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                        <ArrowRight size={12} />
                        Lunasi KPR
                      </span>
                    )}
                    {!isKprCheaper && !isKprExpensive && (
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

function RecommendationPanel() {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
      <div className="flex items-start gap-3">
        <Target size={24} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base font-bold text-emerald-900">Rekomendasi Strategi</h3>
          <div className="mt-3 space-y-3 text-sm text-emerald-800">
            <div className="flex items-start gap-2">
              <span className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-semibold">Lunasi di Oktober 2026 (IDEAL)</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Sisa pokok Rp 374.877.462 + penalti 2.5% Rp 9.371.937 = Rp 384.249.399.
                  Grand total: Rp 480.797.799. <strong>Hemat Rp 377.984.332 (44%)</strong>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-semibold">Jika belum cukup dana, lunasi sebelum November 2029</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Kumpulkan dana selama fase 8%. Lunasi sebelum bunga naik ke 10.25%.
                  Hemat Rp 292.831.428 (34%)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-semibold">Alternatif: bayar ekstra minimum 6x angsuran per tahun</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Pelunasan sebagian mengurangi pokok dan total bunga.
                  Penalti hanya 2.5% dari jumlah yang dilunasi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyInsightCards() {
  const insights = [
    {
      label: 'Total Bunga 20 Tahun',
      value: 'Rp 443.782.131',
      detail: '107% dari pokok pinjaman',
      color: 'text-red-600',
    },
    {
      label: 'Harga Rumah Sebenarnya',
      value: 'Rp 982.782.131',
      detail: 'Harga beli + DP + bunga KPR',
      color: 'text-gray-900',
    },
    {
      label: 'Multiplier',
      value: '1.8x',
      detail: 'Anda membayar 1.8x harga rumah',
      color: 'text-amber-600',
    },
    {
      label: 'Hemat jika Lunasi Okt 2026',
      value: 'Rp 377.984.332',
      detail: '44% dari total biaya 20 tahun',
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {insights.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">{item.label}</p>
          <p className={`text-xl font-bold mt-1 ${item.color}`}>{item.value}</p>
          <p className="text-[10px] text-gray-400 mt-1">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function InsightsPage() {
  const { milestones, opportunityCost, currentRate } = useMemo(() => generateInsights(), []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Insights</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analisa keuangan dan rekomendasi strategi KPR dari perspektif financial analyst
        </p>
      </div>

      {/* Key Insight Cards */}
      <KeyInsightCards />

      {/* Recommendation */}
      <RecommendationPanel />

      {/* Milestones */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Milestone & Alert</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {milestones.map((m, i) => (
            <MilestoneCard key={i} milestone={m} />
          ))}
        </div>
      </div>

      {/* Opportunity Cost */}
      <OpportunityCostTable rows={opportunityCost} currentRate={currentRate} />

      {/* Analysis Note */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Catatan Analisa</p>
        <p>
          Analisa ini berdasarkan data KPR BRI dengan struktur bunga berjenjang (stepped fixed rate).
          Bunga KPR fase 3 (10.25%) lebih tinggi dari hampir semua instrumen investasi risiko rendah-menengah di Indonesia.
          Kecuali Anda bisa konsisten mendapatkan return {'>'}10.25%/tahun, secara finansial lebih menguntungkan untuk melunasi KPR.
        </p>
        <p className="mt-2">
          <strong>Opportunity cost</strong> = selisih antara return investasi dan bunga KPR.
          Jika return investasi {'<'} bunga KPR, uang lebih baik digunakan untuk melunasi KPR.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/insights')({
  component: InsightsPage,
});
