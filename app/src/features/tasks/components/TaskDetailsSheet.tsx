import { Sheet, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { ActivityTimeline } from "@/features/activities/components/ActivityTimeline";
import { useTaskActivities } from "@/features/activities/api/useActivities";
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_EMOJI,
  TASK_STATUS_LABELS,
  type TaskType,
  type TaskStatus,
  type TaskDTO,
} from "../types/task";
import { Calendar, Clock, User, Briefcase } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────

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

// ─── Status badge variant ────────────────────────────────────

function statusVariant(status: TaskStatus) {
  switch (status) {
    case "done":
      return "success" as const;
    case "cancelled":
    case "system_cancelled":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

// ─── Component ───────────────────────────────────────────────

interface TaskDetailsSheetProps {
  task: TaskDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailsSheet({ task, open, onOpenChange }: TaskDetailsSheetProps) {
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTaskActivities(open && task ? task.id : undefined);

  const activities = data?.pages.flatMap((p) => p.items);

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <span className="text-xl">
            {TASK_TYPE_EMOJI[task.type as TaskType] ?? "📌"}
          </span>
          <SheetTitle>{task.title}</SheetTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
          </Badge>
          <Badge variant={statusVariant(task.status as TaskStatus)} className="text-xs">
            {TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}
          </Badge>
        </div>
      </SheetHeader>

      <SheetBody>
        <div className="flex flex-col gap-6">
          {/* Task details */}
          <div className="flex flex-col gap-3">
            {/* Client */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {task.clientName ? (
                <>
                  <User className="h-4 w-4" />
                  <span className="text-foreground font-medium">{task.clientName}</span>
                </>
              ) : (
                <>
                  <Briefcase className="h-4 w-4" />
                  <span className="italic">Zadanie ogólne</span>
                </>
              )}
            </div>

            {/* Due date */}
            {task.dueDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDate(task.dueDate)} {formatTime(task.dueDate)}
                </span>
              </div>
            )}

            {/* Duration */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{task.durationMin} minut</span>
            </div>

            {/* Description */}
            {task.description && (
              <div className="rounded-lg bg-[var(--surface-4)] p-3">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Activity timeline */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Historia zadania
            </h3>
            <ActivityTimeline
              activities={activities}
              isLoading={isLoading}
              emptyMessage="Brak historii dla tego zadania."
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
            />
          </div>
        </div>
      </SheetBody>
    </Sheet>
  );
}
