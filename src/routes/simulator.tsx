import { createFileRoute } from '@tanstack/react-router';

function SimulatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Simulasi skenario pembayaran dan pelunasan dipercepat</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <p>Simulator akan tersedia setelah CMS terkoneksi...</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/simulator')({
  component: SimulatorPage,
});
