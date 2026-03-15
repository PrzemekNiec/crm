import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchClients, clientsQueryKey } from "./clients";

/**
 * Fetches all active clients for the current user.
 * Query is disabled until the user is authenticated.
 */
export function useClients() {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: clientsQueryKey(uid ?? ""),
    queryFn: () => fetchClients(uid!),
    enabled: !!uid,
  });
}
