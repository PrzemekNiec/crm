import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/components/ui/Toast";
import {
  fetchDeals,
  createDeal,
  updateDealStage,
  updateDealTitle,
  updateDealValue,
  updateDealNotes,
  addDealNote,
  toggleDealWatch,
  toggleCPRegistration,
  updateDealCommission,
  updateDealBank,
  archiveDeal,
  rejectDeal,
  dealsQueryKey,
} from "./deals";
import { tasksQueryKey } from "@/features/tasks/api/tasks";
import type { TaskDTO } from "@/features/tasks/types/task";
import type { DealDTO, DealFormValues, DealStage, SettleDealValues } from "../types/deal";

// ─── Fetch all deals ────────────────────────────────────────

export function useDeals() {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: dealsQueryKey(uid ?? ""),
    queryFn: () => fetchDeals(uid!),
    enabled: !!uid,
  });
}

// ─── Create deal ────────────────────────────────────────────

export function useCreateDeal() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (values: DealFormValues & { clientName?: string }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return createDeal(uid, values);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
      toast.success("Szansa sprzedażowa dodana");
    },
    onError: () => {
      toast.error("Nie udało się dodać szansy sprzedażowej");
    },
  });
}

// ─── Update deal stage (drag & drop) ────────────────────────

export function useUpdateDealStage() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      stage,
    }: {
      dealId: string;
      stage: DealStage;
    }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return updateDealStage(uid, dealId, stage);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować etapu");
    },
  });
}

// ─── Update deal title ──────────────────────────────────────

export function useUpdateDealTitle() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, title }: { dealId: string; title: string }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return updateDealTitle(uid, dealId, title);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować tytułu");
    },
  });
}

// ─── Update deal value ──────────────────────────────────────

export function useUpdateDealValue() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, value }: { dealId: string; value: number }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return updateDealValue(uid, dealId, value);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować kwoty");
    },
  });
}

// ─── Update deal notes ──────────────────────────────────────

export function useUpdateDealNotes() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, notes }: { dealId: string; notes: string }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return updateDealNotes(uid, dealId, notes);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zapisać notatki");
    },
  });
}

// ─── Add deal note ──────────────────────────────────────

export function useAddDealNote() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, text }: { dealId: string; text: string }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return addDealNote(uid, dealId, text);
    },
    onMutate: async ({ dealId, text }) => {
      if (!uid) return;
      await qc.cancelQueries({ queryKey: dealsQueryKey(uid) });
      const previous = qc.getQueryData<DealDTO[]>(dealsQueryKey(uid));
      const now = new Date().toISOString();
      qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
        old?.map((d) =>
          d.id === dealId
            ? { ...d, dealNotes: [...(d.dealNotes ?? []), { text, createdAt: now }] }
            : d
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (uid && context?.previous) {
        qc.setQueryData(dealsQueryKey(uid), context.previous);
      }
      toast.error("Nie udało się dodać notatki");
    },
    onSettled: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
  });
}

// ─── Toggle deal watch flag ─────────────────────────────

export function useToggleDealWatch() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, isWatched }: { dealId: string; isWatched: boolean }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return toggleDealWatch(uid, dealId, isWatched);
    },
    onMutate: async ({ dealId, isWatched }) => {
      if (!uid) return;
      await qc.cancelQueries({ queryKey: dealsQueryKey(uid) });
      const previous = qc.getQueryData<DealDTO[]>(dealsQueryKey(uid));
      qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
        old?.map((d) =>
          d.id === dealId ? { ...d, isWatched } : d
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (uid && context?.previous) {
        qc.setQueryData(dealsQueryKey(uid), context.previous);
      }
      toast.error("Nie udało się zaktualizować flagi");
    },
    onSettled: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
  });
}

// ─── Toggle CP registration ────────────────────────────────

export function useToggleCPRegistration() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      value,
    }: {
      dealId: string;
      value: boolean;
    }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return toggleCPRegistration(uid, dealId, value);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować rejestracji CP");
    },
  });
}

// ─── Update deal commission ─────────────────────────────────

export function useUpdateDealCommission() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      rate,
      value,
    }: {
      dealId: string;
      rate: number;
      value: number;
    }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return updateDealCommission(uid, dealId, rate, value);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować prowizji");
    },
  });
}

// ─── Update deal bank ───────────────────────────────────────

export function useUpdateDealBank() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, bank }: { dealId: string; bank: string }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return updateDealBank(uid, dealId, bank);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować banku");
    },
  });
}

// ─── Archive deal (settlement) ──────────────────────────────

export function useArchiveDeal() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      values,
    }: {
      dealId: string;
      values: SettleDealValues;
    }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return archiveDeal(uid, dealId, values);
    },
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
      toast.success("Szansa zarchiwizowana");
    },
    onError: () => {
      toast.error("Nie udało się zarchiwizować szansy");
    },
  });
}

// ─── Reject deal (negative decision) ───────────────────────

export function useRejectDeal() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      clientId,
      reason,
    }: {
      dealId: string;
      clientId: string;
      reason: string;
    }) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return rejectDeal(uid, dealId, clientId, reason);
    },

    // Optimistic UI: instantly mark deal as rejected + tasks as cancelled
    onMutate: async ({ dealId, clientId }) => {
      if (!uid) return;

      await qc.cancelQueries({ queryKey: dealsQueryKey(uid) });
      await qc.cancelQueries({ queryKey: tasksQueryKey(uid) });

      const previousDeals = qc.getQueryData<DealDTO[]>(dealsQueryKey(uid));
      const previousTasks = qc.getQueryData<TaskDTO[]>(tasksQueryKey(uid));

      qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
        old?.map((d) =>
          d.id === dealId
            ? { ...d, isRejected: true, isArchived: true }
            : d
        )
      );

      qc.setQueryData<TaskDTO[]>(tasksQueryKey(uid), (old) =>
        old?.map((t) =>
          t.clientId === clientId && t.status === "open"
            ? { ...t, status: "system_cancelled" as const }
            : t
        )
      );

      return { previousDeals, previousTasks };
    },

    onError: (_err, _vars, context) => {
      if (uid && context) {
        if (context.previousDeals) {
          qc.setQueryData(dealsQueryKey(uid), context.previousDeals);
        }
        if (context.previousTasks) {
          qc.setQueryData(tasksQueryKey(uid), context.previousTasks);
        }
      }
      toast.error("Nie udało się odrzucić wniosku");
    },

    onSettled: () => {
      if (!uid) return;
      qc.invalidateQueries({ queryKey: dealsQueryKey(uid) });
      qc.invalidateQueries({ queryKey: tasksQueryKey(uid) });
    },

    onSuccess: (result) => {
      const count = result.cancelledTaskIds.length;
      const taskMsg = count > 0 ? ` (anulowano ${count} zadań)` : "";
      toast.success(`Wniosek odrzucony — przeniesiony do archiwum${taskMsg}`);
    },
  });
}
