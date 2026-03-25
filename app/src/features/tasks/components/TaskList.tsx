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
import { useCompleteTask, useRescheduleTask } from "../api/useUpdateTask";
import { useDeleteTask } from "../api/useDeleteTask";
import {
  Briefcase,
  Calendar,
  Check,
  Clock,
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

function syncBadge(state: string) {
  switch (state) {
    case "synced":
      return <Badge variant="success">Zsynchronizowane</Badge>;
    case "pending":
      return <Badge variant="warning">Oczekuje</Badge>;
    case "failed":
      return <Badge variant="destructive">Błąd synchronizacji</Badge>;
    case "reauth_required":
      return (
        <Badge variant="destructive">Wymagana ponowna autoryzacja</Badge>
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
      },
      {
        onSuccess: () => onOpenChange(false),
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
  const complete = useCompleteTask();
  const deleteTask = useDeleteTask();

  const isDone = task.status === "done" || task.status === "cancelled";

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Complete — green */}
        {!isDone && (
          <button
            type="button"
            onClick={() => complete.mutate(task.id)}
            disabled={complete.isPending}
            title="Oznacz jako wykonane"
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

        {/* Delete — red */}
        <button
          type="button"
          onClick={() =>
            deleteTask.mutate({
              taskId: task.id,
              googleEventId: task.googleEventId,
              syncToGoogleCalendar: task.syncToGoogleCalendar,
            })
          }
          disabled={deleteTask.isPending}
          title="Usuń"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 text-red-500 transition-all hover:bg-red-500 hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <RescheduleDialog
        task={task}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
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
    <div className="flex flex-col gap-2">
      {filtered.map((task) => (
        <div
          key={task.id}
          className={`rounded-xl p-4 transition-colors ${
            task.status === "done" ? "opacity-60" : ""
          }`}
          style={{
            ...GLASS,
            border: task.dueDate && isOverdue(task.dueDate) && !isToday(task.dueDate) && task.status !== "done"
              ? "1px solid rgba(239, 68, 68, 0.3)"
              : undefined,
          }}
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
                {task.syncToGoogleCalendar && syncBadge(task.syncState)}
              </div>
            </div>

            {/* Actions */}
            <TaskActions task={task} />
          </div>
        </div>
      ))}
    </div>
  );
}
