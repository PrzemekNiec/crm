import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/components/ui/Toast";
import {
  fetchDeals,
  createDeal,
  updateDealStage,
  updateDealTitle,
  toggleCPRegistration,
  dealsQueryKey,
} from "./deals";
import type { DealFormValues, DealStage } from "../types/deal";

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
