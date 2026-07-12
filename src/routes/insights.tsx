import { createFileRoute } from '@tanstack/react-router';

function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Insights</h1>
        <p className="text-sm text-gray-500 mt-1">Analisa keuangan dan rekomendasi strategi KPR</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <p>Insights akan dimuat dari CMS...</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/insights')({
  component: InsightsPage,
});
