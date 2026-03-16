import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { useAuthStore } from "@/store/useAuthStore";
import { getFunctions } from "@/lib/firebase";
import { createTask, tasksQueryKey, generateGoogleEventId } from "./tasks";
import { clientsQueryKey } from "@/features/clients/api/clients";
import { toast } from "@/components/ui/Toast";
import type { TaskFormValues } from "../types/task";

interface SyncResponse {
  success: boolean;
  googleEventId: string;
  htmlLink: string | null;
}

/**
 * Mutation hook for creating a new task.
 * If syncToGoogleCalendar is enabled and a dueDate is set,
 * it also syncs the task to Google Calendar.
 */
export function useCreateTask() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: TaskFormValues) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");

      // 1. Create task in Firestore
      const taskId = await createTask({ ...values, uid });

      // 2. Sync to Google Calendar if enabled + has due date
      const shouldSync = values.syncToGoogleCalendar && values.dueDate !== "";

      if (shouldSync) {
        try {
          const syncFn = httpsCallable<
            {
              taskId: string;
              title: string;
              description: string;
              dueDate: string;
              durationMin: number;
              googleEventId: string;
              type?: string;
            },
            SyncResponse
          >(getFunctions(), "syncTaskToGoogleCalendar");

          await syncFn({
            taskId,
            title: values.title,
            description: values.description,
            dueDate: values.dueDate,
            durationMin: values.durationMin,
            googleEventId: generateGoogleEventId(taskId),
            type: values.type,
          });

          toast.success("Zadanie zapisane i dodane do kalendarza!");
        } catch (err) {
          console.error("Calendar sync failed:", err);
          toast.error(
            "Zadanie zapisane, ale synchronizacja z kalendarzem nie powiodła się."
          );
        }
      } else {
        toast.success("Zadanie zostało dodane");
      }

      return taskId;
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
        queryClient.invalidateQueries({ queryKey: clientsQueryKey(uid) });
      }
    },
  });
}
