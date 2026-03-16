import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "@/lib/firebase";
import { toast } from "@/components/ui/Toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { googleIntegrationQueryKey } from "@/features/settings/api/integrations";

interface WatchResult {
  success: boolean;
  channelId: string;
}

export function useCalendarWatch() {
  const [isRegistering, setIsRegistering] = useState(false);
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.uid);

  const registerWatch = async () => {
    setIsRegistering(true);
    try {
      const fn = httpsCallable<void, WatchResult>(
        getFunctions(),
        "registerCalendarWatch"
      );
      await fn();
      toast.success("Synchronizacja dwukierunkowa aktywowana.");
      if (uid) {
        qc.invalidateQueries({
          queryKey: googleIntegrationQueryKey(uid),
        });
      }
    } catch (err: unknown) {
      console.error("registerCalendarWatch failed:", err);
      const message =
        err instanceof Error ? err.message : "Nieznany błąd";
      toast.error(`Nie udało się aktywować synchronizacji: ${message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  return { registerWatch, isRegistering };
}
