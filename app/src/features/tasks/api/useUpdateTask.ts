import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { serverTimestamp } from "firebase/firestore";
import { useAuthStore } from "@/store/useAuthStore";
import { getFunctions } from "@/lib/firebase";
import {
  rescheduleTask,
  retrySyncTask,
  tasksQueryKey,
  generateGoogleEventId,
} from "./tasks";
import {
  logTaskActivity,
  createActivity,
  clientActivitiesQueryKey,
  taskActivitiesQueryKey,
} from "@/features/activities/api/activities";
import { toast } from "@/components/ui/Toast";

// ─── Complete task (with activity log) ──────────────────────

export interface CompleteTaskInput {
  taskId: string;
  clientId: string | null;
  note?: string;
  taskTitle?: string;
  taskType?: string;
}

export function useCompleteTask() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompleteTaskInput) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      await logTaskActivity(uid, {
        taskId: input.taskId,
        clientId: input.clientId,
        type: "TASK_COMPLETED",
        note: input.note,
        metadata: {
          taskTitle: input.taskTitle,
          taskType: input.taskType,
        },
        taskUpdate: {
          status: "done",
          completedAt: serverTimestamp(),
          resultNote: input.note ?? "",
        },
      });
    },
    onSuccess: (_data, input) => {
      if (!uid) return;
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
      if (input.clientId) {
        queryClient.invalidateQueries({
          queryKey: clientActivitiesQueryKey(uid, input.clientId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: taskActivitiesQueryKey(uid, input.taskId),
      });
      toast.success("Zadanie oznaczone jako wykonane");
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować zadania");
    },
  });
}

// ─── Cancel task (with activity log) ────────────────────────

export interface CancelTaskInput {
  taskId: string;
  clientId: string | null;
  note?: string;
  taskTitle?: string;
  taskType?: string;
}

export function useCancelTask() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CancelTaskInput) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      await logTaskActivity(uid, {
        taskId: input.taskId,
        clientId: input.clientId,
        type: "TASK_CANCELLED",
        note: input.note,
        metadata: {
          taskTitle: input.taskTitle,
          taskType: input.taskType,
        },
        taskUpdate: {
          status: "cancelled",
        },
      });
    },
    onSuccess: (_data, input) => {
      if (!uid) return;
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
      if (input.clientId) {
        queryClient.invalidateQueries({
          queryKey: clientActivitiesQueryKey(uid, input.clientId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: taskActivitiesQueryKey(uid, input.taskId),
      });
      toast.success("Zadanie anulowane");
    },
    onError: () => {
      toast.error("Nie udało się anulować zadania");
    },
  });
}

// ─── Reschedule task ────────────────────────────────────────

export interface RescheduleInput {
  taskId: string;
  dueDate: string;
  title: string;
  description: string;
  durationMin: number;
  googleEventId: string | null;
  syncToGoogleCalendar: boolean;
  type?: string;
  clientId?: string | null;
  note?: string;
  oldDueDate?: string | null;
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

      // Log activity for reschedule
      const metadata: Record<string, string> = {
        newDate: input.dueDate,
        taskTitle: input.title,
      };
      if (input.oldDueDate) metadata.oldDate = input.oldDueDate;
      if (input.type) metadata.taskType = input.type;

      try {
        await createActivity(uid, {
          clientId: input.clientId ?? null,
          taskId: input.taskId,
          dealId: null,
          type: "TASK_RESCHEDULED",
          note: input.note ?? "",
          metadata,
        });
      } catch (err) {
        console.error("[Reschedule] Failed to create activity:", err);
      }

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
    onSuccess: (_data, input) => {
      if (!uid) return;
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
      if (input.clientId) {
        queryClient.invalidateQueries({
          queryKey: clientActivitiesQueryKey(uid, input.clientId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: taskActivitiesQueryKey(uid, input.taskId),
      });
    },
    onError: () => {
      toast.error("Nie udało się przełożyć zadania");
    },
  });
}

// ─── Update task details (title, type) ──────────────────────

export interface UpdateTaskDetailsInput {
  taskId: string;
  title?: string;
  type?: string;
  syncToGoogleCalendar: boolean;
  // For calendar re-sync
  dueDate?: string | null;
  description?: string;
  durationMin?: number;
  googleEventId?: string | null;
}

export function useUpdateTaskDetails() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTaskDetailsInput) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");

      const { updateDoc: firestoreUpdate, doc, increment, serverTimestamp: srvTs } = await import("firebase/firestore");
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();
      const ref = doc(db, "users", uid, "tasks", input.taskId);

      const updates: Record<string, unknown> = { updatedAt: srvTs() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.type !== undefined) updates.type = input.type;

      // Bump syncRevision if synced to calendar (title/type change must propagate)
      if (input.syncToGoogleCalendar) {
        updates.syncRevision = increment(1);
        updates.syncState = "pending";
      }

      await firestoreUpdate(ref, updates);

      // Re-sync to Google Calendar
      if (input.syncToGoogleCalendar && input.dueDate) {
        try {
          const syncFn = httpsCallable(getFunctions(), "syncTaskToGoogleCalendar");
          await syncFn({
            taskId: input.taskId,
            title: input.title,
            description: input.description ?? "",
            dueDate: input.dueDate,
            durationMin: input.durationMin ?? 30,
            googleEventId: input.googleEventId || generateGoogleEventId(input.taskId),
            type: input.type,
          });
        } catch {
          // Sync will retry later via Cloud Function
        }
      }
    },
    onSuccess: () => {
      if (!uid) return;
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować zadania");
    },
  });
}

// ─── Retry calendar sync ─────────────────────────────────────

export interface RetrySyncInput {
  taskId: string;
  title: string;
  description: string;
  dueDate: string;
  durationMin: number;
  googleEventId: string | null;
  type?: string;
}

export function useRetrySync() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RetrySyncInput) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");

      const task = await retrySyncTask(uid, input.taskId);

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

      return task;
    },
    onSuccess: () => {
      if (!uid) return;
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
      toast.success("Synchronizacja z kalendarzem zakończona pomyślnie");
    },
    onError: () => {
      toast.error("Ponowna synchronizacja nie powiodła się");
    },
  });
}
