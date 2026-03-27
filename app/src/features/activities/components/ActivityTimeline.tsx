import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_EMOJI,
  type ActivityDTO,
  type ActivityType,
} from "../types/activity";
import { GLASS } from "@/lib/glass";

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

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Przed chwilą";
  if (diffMin < 60)
    return `${diffMin} ${diffMin === 1 ? "minutę" : diffMin < 5 ? "minuty" : "minut"} temu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)
    return `${diffH} ${diffH === 1 ? "godzinę" : diffH < 5 ? "godziny" : "godzin"} temu`;
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

// ─── Color for activity type ─────────────────────────────────

const ACTIVITY_TYPE_COLOR: Record<ActivityType, string> = {
  TASK_CREATED: "border-blue-500/40",
  TASK_COMPLETED: "border-emerald-500/40",
  TASK_RESCHEDULED: "border-amber-500/40",
  TASK_CANCELLED: "border-red-500/40",
  NOTE_MANUAL: "border-primary/40",
  LEAD_CONVERTED: "border-violet-500/40",
  DEAL_WON: "border-emerald-500/40",
  DEAL_REJECTED: "border-red-500/40",
};

// ─── Reschedule metadata renderer ────────────────────────────

function RescheduleInfo({ activity }: { activity: ActivityDTO }) {
  const { oldDate, newDate } = activity.metadata;
  if (!oldDate && !newDate) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {oldDate && (
        <span className="line-through">{formatDate(oldDate)}</span>
      )}
      {oldDate && newDate && <span>&rarr;</span>}
      {newDate && (
        <span className="font-medium text-foreground">
          {formatDate(newDate)}
        </span>
      )}
    </div>
  );
}

// ─── Single activity item ────────────────────────────────────

function ActivityItem({ activity }: { activity: ActivityDTO }) {
  const borderColor = ACTIVITY_TYPE_COLOR[activity.type] ?? "border-primary/40";

  return (
    <div
      className={`rounded-xl p-4 border-l-[3px] ${borderColor}`}
      style={GLASS}
    >
      <div className="flex items-start gap-3">
        {/* Emoji */}
        <span className="mt-0.5 text-lg leading-none shrink-0">
          {ACTIVITY_TYPE_EMOJI[activity.type]}
        </span>

        <div className="flex-1 min-w-0">
          {/* Type label + task title */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {ACTIVITY_TYPE_LABELS[activity.type]}
            </span>
            {activity.metadata.taskTitle && activity.type !== "NOTE_MANUAL" && (
              <span className="text-xs text-muted-foreground truncate">
                — {activity.metadata.taskTitle}
              </span>
            )}
            {activity.metadata.dealTitle && (
              <span className="text-xs text-muted-foreground truncate">
                — {activity.metadata.dealTitle}
              </span>
            )}
          </div>

          {/* Reschedule dates */}
          {activity.type === "TASK_RESCHEDULED" && (
            <RescheduleInfo activity={activity} />
          )}

          {/* Rejection reason */}
          {activity.metadata.rejectionReason && (
            <p className="mt-1 text-xs text-red-400">
              Powód: {activity.metadata.rejectionReason}
            </p>
          )}

          {/* Note */}
          {activity.note && (
            <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">
              {activity.note}
            </p>
          )}

          {/* Timestamp */}
          {activity.createdAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              {formatRelative(activity.createdAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4 animate-pulse border-l-[3px] border-muted"
          style={GLASS}
        >
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-64 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────

function TimelineEmpty({ message }: { message?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl p-12 text-center"
      style={GLASS}
    >
      <span className="text-4xl">📭</span>
      <p className="text-sm text-muted-foreground">
        {message ?? "Brak wpisów na osi czasu."}
      </p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export interface ActivityTimelineProps {
  activities: ActivityDTO[] | undefined;
  isLoading: boolean;
  emptyMessage?: string;
}

export function ActivityTimeline({
  activities,
  isLoading,
  emptyMessage,
}: ActivityTimelineProps) {
  if (isLoading) return <TimelineSkeleton />;

  if (!activities || activities.length === 0) {
    return <TimelineEmpty message={emptyMessage} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
