import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { updateClient, clientsQueryKey, clientQueryKey } from "./clients";
import type { ClientFormValues } from "../types/client";

export function useUpdateClient(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<ClientFormValues>) =>
      updateClient(uid!, clientId!, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientsQueryKey(uid ?? "") });
      if (clientId) {
        qc.invalidateQueries({
          queryKey: clientQueryKey(uid ?? "", clientId),
        });
      }
    },
  });
}
