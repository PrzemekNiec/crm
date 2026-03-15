import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchLeads, createLead, leadsQueryKey } from "./leads";
import type { LeadFormValues } from "../types/lead";

export function useLeads() {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: leadsQueryKey(uid ?? ""),
    queryFn: () => fetchLeads(uid!),
    enabled: !!uid,
  });
}

export function useCreateLead() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (values: LeadFormValues) => createLead(uid!, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadsQueryKey(uid ?? "") });
    },
  });
}
