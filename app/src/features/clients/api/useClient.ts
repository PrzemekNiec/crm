import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchClient, clientQueryKey } from "./clients";

/**
 * Fetches a single client by ID.
 * Query is disabled until uid and clientId are available.
 */
export function useClient(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: clientQueryKey(uid ?? "", clientId ?? ""),
    queryFn: () => fetchClient(uid!, clientId!),
    enabled: !!uid && !!clientId,
  });
}
