// ============================================================
// Payload CMS REST API Client
// ============================================================

import type {
  PayloadResponse,
  KprLoan,
  KprRateTier,
  KprScheduleEntry,
  KprExtraPayment,
  KprReminder,
  KprSimulation,
  KprStatus,
  EarlyPayoffResult,
  ExtraPaymentResult,
  FinancialInsights,
} from '@/types';

const CMS_URL = import.meta.env.VITE_CMS_URL || 'http://localhost:3001';

// ============================================================
// Base fetch helper
// ============================================================

async function cmsFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('monetalis_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${CMS_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API Error: ${res.status}`);
  }

  return res.json();
}

// ============================================================
// Auth
// ============================================================

export async function login(email: string, password: string) {
  const res = await cmsFetch<{ user: { id: string; email: string }; token: string }>(
    '/api/monetalis-users/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  localStorage.setItem('monetalis_token', res.token);
  return res;
}

export function logout() {
  localStorage.removeItem('monetalis_token');
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('monetalis_token');
}

export function getLoanId(): string {
  try {
    const stored = localStorage.getItem('monetalis_user');
    if (stored) {
      const user = JSON.parse(stored);
      return user.loanId || '';
    }
  } catch {
    // intentionally ignored — fallback to empty string
  }
  return '';
}

export async function fetchCurrentUser() {
  try {
    const token = localStorage.getItem('monetalis_token');
    if (!token) return null;

    // Decode JWT to get user ID
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.id;
    if (!userId) return null;

    const res = await cmsFetch<any>(`/api/monetalis-users/${userId}?depth=1`);
    return {
      id: res.id,
      email: res.email,
      name: res.name,
      role: res.role,
      loan: typeof res.loan === 'object' ? res.loan?.id : res.loan,
    };
  } catch {
    return null;
  }
}

// ============================================================
// KPR Loans
// ============================================================

export async function fetchKprLoans() {
  return cmsFetch<PayloadResponse<KprLoan>>('/api/kpr-loans?limit=10');
}

export async function fetchKprLoan(id: string) {
  return cmsFetch<KprLoan>(`/api/kpr-loans/${id}`);
}

// ============================================================
// Rate Tiers
// ============================================================

export async function fetchRateTiers(loanId: string) {
  return cmsFetch<PayloadResponse<KprRateTier>>(
    `/api/kpr-rate-tiers?where[loan][equals]=${loanId}&sort=tierOrder`,
  );
}

// ============================================================
// Schedule
// ============================================================

export async function fetchSchedule(loanId: string) {
  return cmsFetch<PayloadResponse<KprScheduleEntry>>(
    `/api/kpr-schedule?where[loan][equals]=${loanId}&sort=monthNumber&limit=250`,
  );
}

export async function markSchedulePaid(id: string, paidDate: string, paidAmount?: number) {
  return cmsFetch<KprScheduleEntry>(`/api/kpr-schedule/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      isPaid: true,
      paidDate,
      ...(paidAmount && { paidAmount }),
    }),
  });
}

export async function bulkMarkPaid(loanId: string, upToMonth: number) {
  // Fetch all unpaid entries up to the given month
  const res = await cmsFetch<PayloadResponse<KprScheduleEntry>>(
    `/api/kpr-schedule?where[loan][equals]=${loanId}&where[monthNumber][lessThanEqual]=${upToMonth}&where[isPaid][equals]=false&limit=250`,
  );

  // Mark each as paid
  const promises = res.docs.map((entry) =>
    cmsFetch<KprScheduleEntry>(`/api/kpr-schedule/${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        isPaid: true,
        paidDate: entry.calendarDate,
        paidAmount: entry.totalInstallment,
      }),
    }),
  );

  return Promise.all(promises);
}

// ============================================================
// Extra Payments
// ============================================================

export async function fetchExtraPayments(loanId: string) {
  return cmsFetch<PayloadResponse<KprExtraPayment>>(
    `/api/kpr-extra-payments?where[loan][equals]=${loanId}&sort=-paymentDate`,
  );
}

export async function createExtraPayment(loanId: string, date: string, amount: number, note?: string) {
  return cmsFetch<KprExtraPayment>('/api/kpr-extra-payments', {
    method: 'POST',
    body: JSON.stringify({ loan: loanId, paymentDate: date, amount, note }),
  });
}

// ============================================================
// Reminders
// ============================================================

export async function fetchReminders(loanId: string) {
  return cmsFetch<PayloadResponse<KprReminder>>(
    `/api/kpr-reminders?where[loan][equals]=${loanId}`,
  );
}

export async function createReminder(loanId: string, email: string, reminderDay: number) {
  return cmsFetch<KprReminder>('/api/kpr-reminders', {
    method: 'POST',
    body: JSON.stringify({ loan: loanId, email, reminderDay, isActive: true }),
  });
}

export async function updateReminder(id: string, data: Partial<KprReminder>) {
  return cmsFetch<KprReminder>(`/api/kpr-reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteReminder(id: string) {
  return cmsFetch(`/api/kpr-reminders/${id}`, { method: 'DELETE' });
}

// ============================================================
// Simulations
// ============================================================

export async function fetchSimulations(loanId: string) {
  return cmsFetch<PayloadResponse<KprSimulation>>(
    `/api/kpr-simulations?where[loan][equals]=${loanId}&sort=-createdAt`,
  );
}

export async function saveSimulation(
  loanId: string,
  name: string,
  scenarioType: KprSimulation['scenarioType'],
  params: Record<string, unknown>,
  results: Record<string, unknown>,
) {
  return cmsFetch<KprSimulation>('/api/kpr-simulations', {
    method: 'POST',
    body: JSON.stringify({ loan: loanId, name, scenarioType, params, results }),
  });
}

export async function deleteSimulation(id: string) {
  return cmsFetch(`/api/kpr-simulations/${id}`, { method: 'DELETE' });
}

// ============================================================
// Custom Endpoints
// ============================================================

// Raw CMS status response (before adaptation)
export interface CmsStatusResponse {
  loanId: string;
  borrowerName: string;
  bankName: string;
  loanAmount: number;
  tenorMonths: number;
  currentMonth: number;
  outstandingBalance: number;
  totalPaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  currentPhase: string;
  currentRate: number;
  currentInstallment: number;
  nextPayment: {
    monthNumber: number;
    date: string;
    principal: number;
    interest: number;
    total: number;
  } | null;
  monthsUntilNextPhase: number | null;
  nextPhaseRate: number | null;
  progressPct: number;
}

export async function fetchKprStatus(loanId: string) {
  return cmsFetch<CmsStatusResponse>(`/api/kpr/status?loanId=${loanId}`);
}

export async function simulateEarlyPayoff(loanId: string, targetMonth: number) {
  return cmsFetch<EarlyPayoffResult>('/api/kpr/simulate/early-payoff', {
    method: 'POST',
    body: JSON.stringify({ loanId, targetMonth }),
  });
}

export async function simulateExtraPayment(loanId: string, monthlyExtra: number, startMonth: number) {
  return cmsFetch<ExtraPaymentResult>('/api/kpr/simulate/extra-payment', {
    method: 'POST',
    body: JSON.stringify({ loanId, monthlyExtra, startMonth }),
  });
}

export async function fetchInsights(loanId: string) {
  return cmsFetch<FinancialInsights>(`/api/kpr/insights?loanId=${loanId}`);
}

export async function sendReminder(reminderId: string, loanId: string) {
  return cmsFetch<{ success: boolean }>('/api/kpr/send-payment-reminder', {
    method: 'POST',
    body: JSON.stringify({ reminderId, loanId }),
  });
}

export async function sendMonthlyInsight(reminderId: string, loanId: string) {
  return cmsFetch<{ success: boolean }>('/api/kpr/send-monthly-insight', {
    method: 'POST',
    body: JSON.stringify({ reminderId, loanId }),
  });
}

export async function seedKprData() {
  return cmsFetch<{ success: boolean; message: string }>('/api/kpr/seed', {
    method: 'POST',
  });
}
