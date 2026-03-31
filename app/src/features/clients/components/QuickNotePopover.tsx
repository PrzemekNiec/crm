import { useState, useRef, useEffect } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useCreateActivity } from "@/features/activities/api/useActivities";

interface QuickNotePopoverProps {
  clientId: string;
  clientName: string;
}

export function QuickNotePopover({ clientId, clientName }: QuickNotePopoverProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const createActivity = useCreateActivity();
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Auto-focus textarea
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 0);
  }, [open]);

  const handleSave = () => {
    const trimmed = note.trim();
    if (!trimmed) return;

    createActivity.mutate(
      {
        clientId,
        taskId: null,
        dealId: null,
        type: "NOTE_MANUAL",
        note: trimmed,
        metadata: {},
      },
      {
        onSuccess: () => {
          toast.success(`Notatka dodana do ${clientName}`);
          setNote("");
          setOpen(false);
        },
      }
    );
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={`Szybka notatka — ${clientName}`}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 text-primary/70 transition-all hover:bg-primary/10 hover:text-primary cursor-pointer"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-50 w-72 rounded-lg border border-border bg-card p-3 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-muted-foreground mb-2">
            Notatka do <span className="font-medium text-foreground">{clientName}</span>
          </p>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Wpisz notatkę..."
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!note.trim() || createActivity.isPending}
              className="text-xs"
            >
              {createActivity.isPending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
