import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  fetchActivitiesByClient,
  fetchActivitiesByTask,
  createActivity,
  clientActivitiesQueryKey,
  taskActivitiesQueryKey,
  type CreateActivityPayload,
  type PaginatedActivities,
} from "./activities";

// ─── Fetch activities by client (paginated) ─────────────────

export function useClientActivities(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useInfiniteQuery<PaginatedActivities>({
    queryKey: clientActivitiesQueryKey(uid ?? "", clientId ?? ""),
    queryFn: ({ pageParam }) =>
      fetchActivitiesByClient(uid!, clientId!, pageParam as PaginatedActivities["lastDoc"]),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled: !!uid && !!clientId,
  });
}

// ─── Fetch activities by task (paginated) ────────────────────

export function useTaskActivities(taskId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useInfiniteQuery<PaginatedActivities>({
    queryKey: taskActivitiesQueryKey(uid ?? "", taskId ?? ""),
    queryFn: ({ pageParam }) =>
      fetchActivitiesByTask(uid!, taskId!, pageParam as PaginatedActivities["lastDoc"]),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled: !!uid && !!taskId,
  });
}

// ─── Create activity (for NOTE_MANUAL etc.) ──────────────────

export function useCreateActivity() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateActivityPayload) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return createActivity(uid, data);
    },
    onSuccess: (_id, variables) => {
      if (!uid) return;
      if (variables.clientId) {
        qc.invalidateQueries({
          queryKey: clientActivitiesQueryKey(uid, variables.clientId),
        });
      }
      if (variables.taskId) {
        qc.invalidateQueries({
          queryKey: taskActivitiesQueryKey(uid, variables.taskId),
        });
      }
    },
  });
}
