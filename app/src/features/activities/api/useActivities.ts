import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  fetchActivitiesByClient,
  fetchActivitiesByTask,
  createActivity,
  clientActivitiesQueryKey,
  taskActivitiesQueryKey,
  type CreateActivityPayload,
} from "./activities";

// ─── Fetch activities by client ──────────────────────────────

export function useClientActivities(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: clientActivitiesQueryKey(uid ?? "", clientId ?? ""),
    queryFn: () => fetchActivitiesByClient(uid!, clientId!),
    enabled: !!uid && !!clientId,
  });
}

// ─── Fetch activities by task ────────────────────────────────

export function useTaskActivities(taskId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: taskActivitiesQueryKey(uid ?? "", taskId ?? ""),
    queryFn: () => fetchActivitiesByTask(uid!, taskId!),
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
      // Invalidate relevant caches
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
