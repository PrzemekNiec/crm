import {
  type ReactNode,
  type HTMLAttributes,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Root ────────────────────────────────────────────────────

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  side?: "right" | "left";
}

export function Sheet({ open, onOpenChange, children, side = "right" }: SheetProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed top-0 bottom-0 z-10 flex w-full max-w-md flex-col border-border bg-card shadow-xl overflow-y-auto",
          "transition-transform duration-200 ease-out",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
        )}
      >
        {children}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Zamknij"
          className="absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer z-10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Sub-components ──────────────────────────────────────────

export function SheetHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 pt-6 pb-4 flex flex-col gap-1.5 pr-12", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function SheetBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 px-6 pb-6 overflow-y-auto", className)}
      {...props}
    />
  );
}
