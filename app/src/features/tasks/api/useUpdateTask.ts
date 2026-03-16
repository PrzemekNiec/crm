import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { useAuthStore } from "@/store/useAuthStore";
import { getFunctions } from "@/lib/firebase";
import {
  completeTask,
  rescheduleTask,
  tasksQueryKey,
  generateGoogleEventId,
} from "./tasks";
import { toast } from "@/components/ui/Toast";

// ─── Complete task ──────────────────────────────────────────

export function useCompleteTask() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      await completeTask(uid, taskId);
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
      }
      toast.success("Zadanie oznaczone jako wykonane");
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować zadania");
    },
  });
}

// ─── Reschedule task ────────────────────────────────────────

interface RescheduleInput {
  taskId: string;
  dueDate: string;
  title: string;
  description: string;
  durationMin: number;
  googleEventId: string | null;
  syncToGoogleCalendar: boolean;
  type?: string;
}

export function useRescheduleTask() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RescheduleInput) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");

      const task = await rescheduleTask({
        uid,
        taskId: input.taskId,
        dueDate: input.dueDate,
      });

      // Re-sync to Google Calendar if applicable
      if (input.syncToGoogleCalendar && input.dueDate) {
        try {
          const syncFn = httpsCallable(
            getFunctions(),
            "syncTaskToGoogleCalendar"
          );
          await syncFn({
            taskId: input.taskId,
            title: input.title,
            description: input.description,
            dueDate: input.dueDate,
            durationMin: input.durationMin,
            googleEventId:
              input.googleEventId || generateGoogleEventId(input.taskId),
            type: input.type,
          });
          toast.success("Zadanie przełożone i kalendarz zaktualizowany");
        } catch {
          toast.error(
            "Zadanie przełożone, ale synchronizacja z kalendarzem nie powiodła się"
          );
        }
      } else {
        toast.success("Zadanie przełożone");
      }

      return task;
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
      }
    },
    onError: () => {
      toast.error("Nie udało się przełożyć zadania");
    },
  });
}
