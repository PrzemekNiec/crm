import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { useAuthStore } from "@/store/useAuthStore";
import { getFunctions } from "@/lib/firebase";
import { deleteTask, tasksQueryKey } from "./tasks";
import { toast } from "@/components/ui/Toast";

interface DeleteInput {
  taskId: string;
  googleEventId: string | null;
  syncToGoogleCalendar: boolean;
}

export function useDeleteTask() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteInput) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");

      // Delete from Google Calendar first (if synced)
      if (input.syncToGoogleCalendar && input.googleEventId) {
        try {
          const deleteFn = httpsCallable(
            getFunctions(),
            "deleteTaskFromGoogleCalendar"
          );
          await deleteFn({
            googleEventId: input.googleEventId,
          });
        } catch (err) {
          console.error("Calendar event delete failed:", err);
          // Continue with Firestore delete even if calendar delete fails
        }
      }

      // Delete from Firestore
      await deleteTask(uid, input.taskId);
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: tasksQueryKey(uid) });
      }
      toast.success("Zadanie usunięte");
    },
    onError: () => {
      toast.error("Nie udało się usunąć zadania");
    },
  });
}
