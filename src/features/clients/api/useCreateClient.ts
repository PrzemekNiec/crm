import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { createClient, clientsQueryKey } from "./clients";
import type { ClientFormValues } from "../types/client";

/**
 * Mutation hook for creating a new client.
 * Automatically injects server timestamps and default flags.
 * Invalidates the clients list cache on success.
 */
export function useCreateClient() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ClientFormValues) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return createClient(uid, values);
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: clientsQueryKey(uid) });
      }
    },
  });
}
