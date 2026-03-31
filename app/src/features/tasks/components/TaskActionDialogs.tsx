import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { TaskDTO } from "../types/task";
import { useCompleteTask, useCancelTask } from "../api/useUpdateTask";

// ─── Complete Task Dialog ────────────────────────────────────

export function CompleteTaskDialog({
  task,
  open,
  onOpenChange,
  onCompleteAndPlanNext,
}: {
  task: TaskDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleteAndPlanNext?: (task: TaskDTO) => void;
}) {
  const complete = useCompleteTask();
  const [note, setNote] = useState("");

  const doComplete = (planNext: boolean) => {
    complete.mutate(
      {
        taskId: task.id,
        clientId: task.clientId || null,
        note: note.trim() || undefined,
        taskTitle: task.title,
        taskType: task.type,
      },
      {
        onSuccess: () => {
          setNote("");
          onOpenChange(false);
          if (planNext && onCompleteAndPlanNext) {
            onCompleteAndPlanNext(task);
          }
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doComplete(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm">
      <DialogHeader>
        <DialogTitle>Zakończ zadanie</DialogTitle>
        <DialogDescription>{task.title}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Dodaj notatkę podsumowującą (opcjonalnie)..."
          rows={3}
          className="w-full resize-none rounded-lg bg-[var(--surface-6)] border border-[var(--surface-8)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            onClick={() => doComplete(false)}
            disabled={complete.isPending}
            variant="secondary"
          >
            {complete.isPending ? "Zapisywanie…" : "Zakończ"}
          </Button>
          {onCompleteAndPlanNext && (
            <Button
              onClick={() => doComplete(true)}
              disabled={complete.isPending}
              className="gap-1.5"
            >
              <CalendarPlus className="h-4 w-4" />
              {complete.isPending ? "Zapisywanie…" : "Ukończ i zaplanuj kolejne"}
            </Button>
          )}
        </DialogFooter>
      </div>
    </Dialog>
  );
}

// ─── Cancel Task Dialog ──────────────────────────────────────

export function CancelTaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: TaskDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancel = useCancelTask();
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    cancel.mutate(
      {
        taskId: task.id,
        clientId: task.clientId || null,
        note: note.trim() || undefined,
        taskTitle: task.title,
        taskType: task.type,
      },
      {
        onSuccess: () => {
          setNote("");
          onOpenChange(false);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm">
      <DialogHeader>
        <DialogTitle>Anuluj zadanie</DialogTitle>
        <DialogDescription>{task.title}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Podaj powód anulowania (opcjonalnie)..."
          rows={3}
          className="w-full resize-none rounded-lg bg-[var(--surface-6)] border border-[var(--surface-8)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Wróć
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={cancel.isPending}
            variant="destructive"
          >
            {cancel.isPending ? "Anulowanie…" : "Anuluj zadanie"}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
