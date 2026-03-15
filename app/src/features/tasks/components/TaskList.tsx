import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_EMOJI,
  type TaskType,
  type TaskDTO,
} from "../types/task";
import { Briefcase, Calendar, Clock, User } from "lucide-react";

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
      return <Badge variant="destructive">Wymagana ponowna autoryzacja</Badge>;
    default:
      return null;
  }
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
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

    // Only show open tasks in today/overdue tabs
    const open = tab === "all" ? tasks : tasks.filter((t) => t.status === "open");

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
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-12 text-center">
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
          className={`rounded-lg border bg-card p-4 transition-colors ${
            task.status === "done"
              ? "border-border/50 opacity-60"
              : task.dueDate && isOverdue(task.dueDate) && !isToday(task.dueDate)
                ? "border-destructive/30"
                : "border-border"
          }`}
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
          </div>
        </div>
      ))}
    </div>
  );
}
