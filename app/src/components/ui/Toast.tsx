import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Toast store ─────────────────────────────────────────────

interface ToastData {
  id: number;
  message: string;
  type: "success" | "error";
}

interface ToastStore {
  toasts: ToastData[];
  add: (message: string, type?: "success" | "error") => void;
  remove: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = "success") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Shortcut to fire a toast from anywhere. */
export const toast = {
  success: (message: string) => useToastStore.getState().add(message, "success"),
  error: (message: string) => useToastStore.getState().add(message, "error"),
};

// ─── Toast container (mount once in App) ─────────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  // Announce to screen readers
  useEffect(() => {
    // intentional — toasts are aria-live
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 md:bottom-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right",
            t.type === "success"
              ? "border-success/30 bg-card text-foreground"
              : "border-destructive/30 bg-card text-foreground"
          )}
        >
          {t.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-success" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => remove(t.id)}
            className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Zamknij powiadomienie"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
