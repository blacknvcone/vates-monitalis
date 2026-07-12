import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';

// ============================================================
// Query Keys
// ============================================================

export const queryKeys = {
  kprLoans: ['kpr-loans'] as const,
  kprLoan: (id: string) => ['kpr-loans', id] as const,
  rateTiers: (loanId: string) => ['kpr-rate-tiers', loanId] as const,
  schedule: (loanId: string) => ['kpr-schedule', loanId] as const,
  extraPayments: (loanId: string) => ['kpr-extra-payments', loanId] as const,
  reminders: (loanId: string) => ['kpr-reminders', loanId] as const,
  simulations: (loanId: string) => ['kpr-simulations', loanId] as const,
  kprStatus: (loanId: string) => ['kpr-status', loanId] as const,
  insights: (loanId: string) => ['kpr-insights', loanId] as const,
};

// Helper: get loanId from auth context
function useLoanId(): string {
  return api.getLoanId();
}

// ============================================================
// KPR Status
// ============================================================

export function useKprStatus() {
  const loanId = useLoanId();
  return useQuery({
    queryKey: queryKeys.kprStatus(loanId),
    queryFn: () => api.fetchKprStatus(loanId),
    enabled: !!loanId,
  });
}

// ============================================================
// Schedule
// ============================================================

export function useSchedule() {
  const loanId = useLoanId();
  return useQuery({
    queryKey: queryKeys.schedule(loanId),
    queryFn: () => api.fetchSchedule(loanId),
    enabled: !!loanId,
  });
}

export function useMarkSchedulePaid() {
  const queryClient = useQueryClient();
  const loanId = useLoanId();
  return useMutation({
    mutationFn: ({ id, paidDate, paidAmount }: { id: string; paidDate: string; paidAmount?: number }) =>
      api.markSchedulePaid(id, paidDate, paidAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule(loanId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.kprStatus(loanId) });
    },
  });
}

export function useBulkMarkPaid() {
  const queryClient = useQueryClient();
  const loanId = useLoanId();
  return useMutation({
    mutationFn: ({ upToMonth }: { upToMonth: number }) =>
      api.bulkMarkPaid(loanId, upToMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule(loanId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.kprStatus(loanId) });
    },
  });
}

// ============================================================
// Extra Payments
// ============================================================

export function useExtraPayments() {
  const loanId = useLoanId();
  return useQuery({
    queryKey: queryKeys.extraPayments(loanId),
    queryFn: () => api.fetchExtraPayments(loanId),
    enabled: !!loanId,
  });
}

export function useCreateExtraPayment() {
  const queryClient = useQueryClient();
  const loanId = useLoanId();
  return useMutation({
    mutationFn: ({ date, amount, note }: { date: string; amount: number; note?: string }) =>
      api.createExtraPayment(loanId, date, amount, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.extraPayments(loanId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule(loanId) });
    },
  });
}

// ============================================================
// Simulations
// ============================================================

export function useSimulations() {
  const loanId = useLoanId();
  return useQuery({
    queryKey: queryKeys.simulations(loanId),
    queryFn: () => api.fetchSimulations(loanId),
    enabled: !!loanId,
  });
}

export function useSaveSimulation() {
  const queryClient = useQueryClient();
  const loanId = useLoanId();
  return useMutation({
    mutationFn: (params: {
      name: string;
      scenarioType: 'early_payoff' | 'extra_payment' | 'refinance';
      params: Record<string, unknown>;
      results: Record<string, unknown>;
    }) => api.saveSimulation(loanId, params.name, params.scenarioType, params.params, params.results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.simulations(loanId) });
    },
  });
}

export function useDeleteSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSimulation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpr-simulations'] });
    },
  });
}

// ============================================================
// Reminders
// ============================================================

export function useReminders() {
  const loanId = useLoanId();
  return useQuery({
    queryKey: queryKeys.reminders(loanId),
    queryFn: () => api.fetchReminders(loanId),
    enabled: !!loanId,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  const loanId = useLoanId();
  return useMutation({
    mutationFn: ({ email, reminderDay }: { email: string; reminderDay: number }) =>
      api.createReminder(loanId, email, reminderDay),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders(loanId) });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpr-reminders'] });
    },
  });
}

// ============================================================
// Insights
// ============================================================

export function useInsights() {
  const loanId = useLoanId();
  return useQuery({
    queryKey: queryKeys.insights(loanId),
    queryFn: () => api.fetchInsights(loanId),
    enabled: !!loanId,
  });
}

// ============================================================
// Email
// ============================================================

export function useSendPaymentReminder() {
  return useMutation({
    mutationFn: ({ reminderId }: { reminderId: string }) => {
      const loanId = useLoanId();
      return api.sendReminder(reminderId, loanId);
    },
  });
}

export function useSendMonthlyInsight() {
  return useMutation({
    mutationFn: ({ reminderId }: { reminderId: string }) => {
      const loanId = useLoanId();
      return api.sendMonthlyInsight(reminderId, loanId);
    },
  });
}
