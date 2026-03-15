import { useNetworkState } from "@/hooks/useNetworkState";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useNetworkState();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground"
    >
      <WifiOff className="h-4 w-4" />
      Działasz w trybie offline. Zmiany zostaną zsynchronizowane po odzyskaniu
      sieci.
    </div>
  );
}
