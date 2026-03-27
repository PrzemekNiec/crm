import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_EMOJI,
  type TaskType,
  type TaskDTO,
} from "../types/task";
import { useRescheduleTask, useRetrySync } from "../api/useUpdateTask";
import { CompleteTaskDialog, CancelTaskDialog } from "./TaskActionDialogs";
import { TaskDetailsSheet } from "./TaskDetailsSheet";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
  Clock,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { GLASS } from "@/lib/glass";

type TabFilter = "today" | "overdue" | "all";

interface TaskListProps {
  tasks: TaskDTO[] | undefined;
  isLoading: boolean;
  tab: TabFilter;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isOverdue(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function syncBadge(task: TaskDTO) {
  switch (task.syncState) {
    case "synced":
      return <Badge variant="success">Zsynchronizowane</Badge>;
    case "pending":
      return <Badge variant="warning">Oczekuje</Badge>;
    case "failed":
      return (
        <span
          className="inline-flex items-center gap-1"
          title={task.syncErrorMessage || "Błąd synchronizacji z kalendarzem"}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          <Badge variant="destructive">Błąd synchronizacji</Badge>
        </span>
      );
    case "reauth_required":
      return (
        <span
          className="inline-flex items-center gap-1"
          title="Token wygasł — wymagane ponowne połączenie z Google Calendar"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          <Badge variant="destructive">Wymagana ponowna autoryzacja</Badge>
        </span>
      );
    default:
      return null;
  }
}

// ─── Time options for reschedule ─────────────────────────────

const TIME_OPTIONS = (() => {
  const opts = [{ value: "", label: "Bez godziny" }];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
    }
  }
  return opts;
})();

// ─── Reschedule Dialog ──────────────────────────────────────

export function RescheduleDialog({
  task,
  open,
  onOpenChange,
}: {
  task: TaskDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reschedule = useRescheduleTask();

  const currentDate = task.dueDate ? task.dueDate.split("T")[0] : "";
  const currentTime = task.dueDate?.split("T")[1]?.slice(0, 5) ?? "";

  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(currentTime);
  const [note, setNote] = useState("");

  const handleSave = () => {
    if (!date) return;
    const dueDate = time ? `${date}T${time}` : `${date}T09:00`;
    reschedule.mutate(
      {
        taskId: task.id,
        dueDate,
        title: task.title,
        description: task.description,
        durationMin: task.durationMin,
        googleEventId: task.googleEventId,
        syncToGoogleCalendar: task.syncToGoogleCalendar,
        type: task.type,
        clientId: task.clientId || null,
        note: note.trim(),
        oldDueDate: task.dueDate,
      },
      {
        onSuccess: () => {
          setNote("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm">
      <DialogHeader>
        <DialogTitle>Przełóż zadanie</DialogTitle>
        <DialogDescription>{task.title}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Godzina</Label>
            <Select
              options={TIME_OPTIONS}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Powód przełożenia (opcjonalnie)..."
          rows={2}
          className="w-full resize-none rounded-lg bg-[var(--surface-6)] border border-[var(--surface-8)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            onClick={handleSave}
            disabled={!date || reschedule.isPending}
          >
            {reschedule.isPending ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}

// ─── Action Buttons ──────────────────────────────────────────

export function TaskActions({ task }: { task: TaskDTO }) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const retrySync = useRetrySync();

  const isDone = task.status === "done" || task.status === "cancelled" || task.status === "system_cancelled";
  const showRetry =
    task.syncToGoogleCalendar &&
    (task.syncState === "failed" || task.syncState === "reauth_required");

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Retry sync — orange */}
        {showRetry && (
          <button
            type="button"
            onClick={() =>
              retrySync.mutate({
                taskId: task.id,
                title: task.title,
                description: task.description,
                dueDate: task.dueDate ?? "",
                durationMin: task.durationMin,
                googleEventId: task.googleEventId,
                type: task.type,
              })
            }
            disabled={retrySync.isPending}
            title="Spróbuj ponownie zsynchronizować z kalendarzem"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/40 text-orange-500 transition-all hover:bg-orange-500 hover:text-white cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrySync.isPending ? "animate-spin" : ""}`} />
          </button>
        )}

        {/* Complete — green */}
        {!isDone && (
          <button
            type="button"
            onClick={() => setCompleteOpen(true)}
            title="Zakończ zadanie"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 text-emerald-500 transition-all hover:bg-emerald-500 hover:text-white cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Reschedule — gold */}
        {!isDone && (
          <button
            type="button"
            onClick={() => setRescheduleOpen(true)}
            title="Przełóż"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/40 text-amber-500 transition-all hover:bg-amber-500 hover:text-white cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Cancel — red */}
        {!isDone && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            title="Anuluj zadanie"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 text-red-500 transition-all hover:bg-red-500 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <CompleteTaskDialog
        task={task}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
      />
      <RescheduleDialog
        task={task}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />
      <CancelTaskDialog
        task={task}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={GLASS}
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export function TaskList({ tasks, isLoading, tab }: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<TaskDTO | null>(null);

  const filtered = useMemo(() => {
    if (!tasks) return [];

    const open =
      tab === "all" ? tasks : tasks.filter((t) => t.status === "open");

    switch (tab) {
      case "today":
        return open.filter((t) => t.dueDate && isToday(t.dueDate));
      case "overdue":
        return open.filter(
          (t) => t.dueDate && isOverdue(t.dueDate) && !isToday(t.dueDate)
        );
      case "all":
        return tasks;
    }
  }, [tasks, tab]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    const messages: Record<TabFilter, string> = {
      today: "Brak zadań na dziś. Możesz odpocząć lub dodać nowe zadanie.",
      overdue: "Brak zaległych zadań. Świetna robota!",
      all: "Brak zadań. Dodaj pierwsze zadanie, klikając przycisk powyżej.",
    };

    return (
      <div
        className="flex flex-col items-center gap-2 rounded-xl p-12 text-center"
        style={GLASS}
      >
        <Calendar className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{messages[tab]}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {filtered.map((task) => (
          <div
            key={task.id}
            className={`rounded-xl p-4 transition-colors cursor-pointer hover:ring-1 hover:ring-white/10 ${
              task.status === "done" ? "opacity-60" : ""
            }`}
            style={{
              ...GLASS,
              border: task.dueDate && isOverdue(task.dueDate) && !isToday(task.dueDate) && task.status !== "done"
                ? "1px solid rgba(239, 68, 68, 0.3)"
                : undefined,
            }}
            onClick={() => setSelectedTask(task)}
          >
            <div className="flex items-start gap-3">
              {/* Type emoji */}
              <span className="mt-0.5 text-lg leading-none">
                {TASK_TYPE_EMOJI[task.type as TaskType] ?? "📌"}
              </span>

              <div className="flex-1 min-w-0">
                {/* Title + status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`font-medium text-foreground ${
                      task.status === "done" ? "line-through" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
                  </Badge>
                  {task.status === "done" && (
                    <Badge variant="success">Wykonane</Badge>
                  )}
                  {task.status === "cancelled" && (
                    <Badge variant="warning">Anulowane</Badge>
                  )}
                </div>

                {/* Client */}
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {task.clientName ? (
                    <>
                      <User className="h-3 w-3" />
                      {task.clientName}
                    </>
                  ) : (
                    <>
                      <Briefcase className="h-3 w-3" />
                      <span className="italic">Zadanie ogólne</span>
                    </>
                  )}
                </div>

                {/* Due date + duration + sync */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(task.dueDate)} {formatTime(task.dueDate)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {task.durationMin} minut
                  </span>
                  {task.syncToGoogleCalendar && syncBadge(task)}
                </div>
              </div>

              {/* Actions — stop propagation so clicking buttons doesn't open sheet */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div onClick={(e) => e.stopPropagation()}>
                <TaskActions task={task} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <TaskDetailsSheet
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
      />
    </>
  );
}
