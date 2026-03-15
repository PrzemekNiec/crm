import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { createTask, tasksQueryKey } from "./tasks";
import { clientsQueryKey } from "@/features/clients/api/clients";
import type { TaskFormValues } from "../types/task";

/**
 * Mutation hook for creating a new task.
 * Invalidates both tasks and clients cache on success
 * (clients may update nextActionAt via Cloud Function).
 */
export function useCreateTask() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: TaskFormValues) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return createTask({ ...values, uid });
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
        queryClient.invalidateQueries({ queryKey: clientsQueryKey(uid) });
      }
    },
  });
}
