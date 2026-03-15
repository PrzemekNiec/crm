import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchTasks, tasksQueryKey } from "./tasks";

/**
 * Fetches all tasks for the current user.
 * Query is disabled until the user is authenticated.
 */
export function useTasks() {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: tasksQueryKey(uid ?? ""),
    queryFn: () => fetchTasks(uid!),
    enabled: !!uid,
  });
}
