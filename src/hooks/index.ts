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

// ============================================================
// KPR Loans
// ============================================================

export function useKprLoans() {
  return useQuery({
    queryKey: queryKeys.kprLoans,
    queryFn: () => api.fetchKprLoans(),
  });
}

export function useKprLoan(id: string) {
  return useQuery({
    queryKey: queryKeys.kprLoan(id),
    queryFn: () => api.fetchKprLoan(id),
    enabled: !!id,
  });
}

// ============================================================
// Schedule
// ============================================================

export function useSchedule(loanId: string) {
  return useQuery({
    queryKey: queryKeys.schedule(loanId),
    queryFn: () => api.fetchSchedule(loanId),
    enabled: !!loanId,
  });
}

export function useMarkSchedulePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidDate, paidAmount }: { id: string; paidDate: string; paidAmount?: number }) =>
      api.markSchedulePaid(id, paidDate, paidAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpr-schedule'] });
    },
  });
}

export function useBulkMarkPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, upToMonth }: { loanId: string; upToMonth: number }) =>
      api.bulkMarkPaid(loanId, upToMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpr-schedule'] });
    },
  });
}

// ============================================================
// Status
// ============================================================

export function useKprStatus(loanId: string) {
  return useQuery({
    queryKey: queryKeys.kprStatus(loanId),
    queryFn: () => api.fetchKprStatus(loanId),
    enabled: !!loanId,
  });
}

// ============================================================
// Simulations
// ============================================================

export function useSimulations(loanId: string) {
  return useQuery({
    queryKey: queryKeys.simulations(loanId),
    queryFn: () => api.fetchSimulations(loanId),
    enabled: !!loanId,
  });
}

export function useSaveSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      loanId: string;
      name: string;
      scenarioType: 'early_payoff' | 'extra_payment' | 'refinance';
      params: Record<string, unknown>;
      results: Record<string, unknown>;
    }) => api.saveSimulation(params.loanId, params.name, params.scenarioType, params.params, params.results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpr-simulations'] });
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

export function useReminders(loanId: string) {
  return useQuery({
    queryKey: queryKeys.reminders(loanId),
    queryFn: () => api.fetchReminders(loanId),
    enabled: !!loanId,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, email, reminderDay }: { loanId: string; email: string; reminderDay: number }) =>
      api.createReminder(loanId, email, reminderDay),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpr-reminders'] });
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

export function useInsights(loanId: string) {
  return useQuery({
    queryKey: queryKeys.insights(loanId),
    queryFn: () => api.fetchInsights(loanId),
    enabled: !!loanId,
  });
}
