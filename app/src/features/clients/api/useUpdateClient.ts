import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { updateClient, clientsQueryKey, clientQueryKey } from "./clients";
import { dealsQueryKey } from "@/features/deals/api/deals";
import { tasksQueryKey } from "@/features/tasks/api/tasks";
import type { ClientFormValues } from "../types/client";

export function useUpdateClient(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<ClientFormValues>) =>
      updateClient(uid!, clientId!, values),
    onSuccess: (_data, values) => {
      const id = uid ?? "";
      qc.invalidateQueries({ queryKey: clientsQueryKey(id) });
      if (clientId) {
        qc.invalidateQueries({ queryKey: clientQueryKey(id, clientId) });
      }
      // When name changed, refresh deals & tasks with updated clientName
      if (values.fullName) {
        qc.invalidateQueries({ queryKey: dealsQueryKey(id) });
        qc.invalidateQueries({ queryKey: tasksQueryKey(id) });
      }
    },
  });
}
