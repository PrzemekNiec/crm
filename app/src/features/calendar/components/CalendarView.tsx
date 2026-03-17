import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/useAuthStore";
import { useTasks } from "@/features/tasks/api/useTasks";
import { useCompleteTask, useRescheduleTask } from "@/features/tasks/api/useUpdateTask";
import { useDeleteTask } from "@/features/tasks/api/useDeleteTask";
import { tasksQueryKey } from "@/features/tasks/api/tasks";
import { TASK_TYPE_EMOJI } from "@/features/tasks/types/task";
import type { TaskDTO } from "@/features/tasks/types/task";
import { cn } from "@/lib/cn";

// ─── Constants ──────────────────────────────────────────────

const HOUR_START = 6;
const HOUR_END = 21;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const ROW_HEIGHT = 60; // px per hour
const DAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const DAY_NAMES_SHORT = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  call:     { bg: "bg-blue-500/20",    border: "border-blue-500/40",    text: "text-blue-300" },
  meeting:  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300" },
  followup: { bg: "bg-amber-500/20",   border: "border-amber-500/40",   text: "text-amber-300" },
  docs:     { bg: "bg-purple-500/20",  border: "border-purple-500/40",  text: "text-purple-300" },
  check:    { bg: "bg-pink-500/20",    border: "border-pink-500/40",    text: "text-pink-300" },
  custom:   { bg: "bg-gray-500/20",    border: "border-gray-500/40",    text: "text-gray-300" },
};

// ─── Helpers ────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

// ─── Task Popup ─────────────────────────────────────────────

function TaskPopup({
  task,
  onClose,
}: {
  task: TaskDTO;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const colors = TYPE_COLORS[task.type] ?? TYPE_COLORS.custom;
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  return (
    <div
      ref={popupRef}
      className="absolute z-30 w-72 rounded-lg border border-border bg-card p-4 shadow-xl"
      style={{ top: 0, right: "calc(100% + 8px)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          {task.clientName && (
            <button
              onClick={() => { navigate(`/clients/${task.clientId}`); onClose(); }}
              className="text-xl font-bold text-foreground hover:text-blue-400 transition-colors truncate block cursor-pointer"
            >
              {task.clientName}
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{TASK_TYPE_EMOJI[task.type]}</span>
            <h3 className="text-base text-muted-foreground truncate">{task.title}</h3>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      {dueDate && (
        <p className="text-xs text-muted-foreground mb-1">
          {dueDate.toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium mb-3 border", colors.bg, colors.border, colors.text)}>
        {task.type}
        {task.durationMin > 0 && ` · ${task.durationMin} min`}
      </div>

      {task.status === "open" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="flex-1 text-xs"
            onClick={() => { completeTask.mutate(task.id); onClose(); }}
          >
            Ukończ
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={() => {
              deleteTask.mutate({
                taskId: task.id,
                googleEventId: task.googleEventId,
                syncToGoogleCalendar: task.syncToGoogleCalendar,
              });
              onClose();
            }}
          >
            Usuń
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function CalendarView() {
  const { data: tasks = [] } = useTasks();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedTask, setSelectedTask] = useState<TaskDTO | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ dayIdx: number; hour: number } | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();
  const reschedule = useRescheduleTask();

  const today = new Date();

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Filter tasks that have dueDate in this week & are open
  const weekTasks = useMemo(() => {
    const start = weekStart.getTime();
    const end = addDays(weekStart, 7).getTime();
    return tasks.filter((t) => {
      if (!t.dueDate || t.status !== "open") return false;
      const ts = new Date(t.dueDate).getTime();
      return ts >= start && ts < end;
    });
  }, [tasks, weekStart]);

  // Group tasks by day index (0=Mon ... 6=Sun)
  const tasksByDay = useMemo(() => {
    const map: Map<number, TaskDTO[]> = new Map();
    for (const t of weekTasks) {
      const d = new Date(t.dueDate!);
      const dayIdx = weekDays.findIndex((wd) => isSameDay(wd, d));
      if (dayIdx >= 0) {
        if (!map.has(dayIdx)) map.set(dayIdx, []);
        map.get(dayIdx)!.push(t);
      }
    }
    return map;
  }, [weekTasks, weekDays]);

  const goToday = useCallback(() => setWeekStart(getMonday(new Date())), []);
  const goPrev = useCallback(() => setWeekStart((w) => addDays(w, -7)), []);
  const goNext = useCallback(() => setWeekStart((w) => addDays(w, 7)), []);

  // ─── Drag & Drop handlers ──────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dayIdx: number) => {
      e.preventDefault();
      setDragOverCell(null);
      setDraggingTaskId(null);

      const taskId = e.dataTransfer.getData("text/plain");
      if (!taskId || !uid) return;

      const task = weekTasks.find((t) => t.id === taskId);
      if (!task) return;

      // Calculate new time from drop Y position
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const rawHour = HOUR_START + offsetY / ROW_HEIGHT;
      const rawMinutes = rawHour * 60;

      // Build new date
      const targetDay = weekDays[dayIdx];
      const newDate = new Date(targetDay);
      newDate.setHours(0, Math.round(rawMinutes - HOUR_START * 60), 0, 0);
      // Recalculate from absolute minutes
      const absMinutes = HOUR_START * 60 + (offsetY / ROW_HEIGHT) * 60;
      const snappedHour = Math.floor(absMinutes / 60);
      const snappedMin = Math.round((absMinutes % 60) / 15) * 15;
      newDate.setHours(snappedHour, snappedMin, 0, 0);

      // Clamp to valid range
      if (newDate.getHours() < HOUR_START) newDate.setHours(HOUR_START, 0, 0, 0);
      if (newDate.getHours() >= HOUR_END) newDate.setHours(HOUR_END - 1, 45, 0, 0);

      // Block drops in the past
      if (newDate.getTime() < Date.now()) {
        toast.error("Nie można przenieść zadania w przeszłość");
        return;
      }

      const newDueDate = newDate.toISOString();
      const oldDueDate = task.dueDate;

      // Optimistic update
      qc.setQueryData<TaskDTO[]>(tasksQueryKey(uid), (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, dueDate: newDueDate } : t))
      );

      // Persist to Firestore + Google Calendar sync
      reschedule.mutate(
        {
          taskId: task.id,
          dueDate: newDueDate,
          title: task.title,
          description: task.description,
          durationMin: task.durationMin,
          googleEventId: task.googleEventId,
          syncToGoogleCalendar: task.syncToGoogleCalendar,
          type: task.type,
        },
        {
          onError: () => {
            // Rollback on failure
            qc.setQueryData<TaskDTO[]>(tasksQueryKey(uid), (old) =>
              old?.map((t) => (t.id === taskId ? { ...t, dueDate: oldDueDate } : t))
            );
          },
        }
      );
    },
    [weekTasks, weekDays, uid, qc, reschedule]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground capitalize">
            {formatMonthYear(weekStart)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Dziś
          </Button>
          <Button variant="ghost" size="sm" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid shrink-0" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        {/* Gutter */}
        <div className="border-b border-r border-border" />
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className={cn(
                "border-b border-r border-border px-2 py-2 text-center",
                isToday && "bg-primary/10"
              )}
            >
              <div className="text-xs text-muted-foreground hidden sm:block">{DAY_NAMES[i]}</div>
              <div className="text-xs text-muted-foreground sm:hidden">{DAY_NAMES_SHORT[i]}</div>
              <div className={cn(
                "text-sm font-semibold mt-0.5",
                isToday ? "text-primary" : "text-foreground"
              )}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid relative" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", minHeight: HOURS.length * ROW_HEIGHT }}>
          {/* Hour labels + horizontal lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-b border-r border-border text-[11px] text-muted-foreground pr-2 pt-1 text-right col-start-1"
              style={{ gridRow: hour - HOUR_START + 1, height: ROW_HEIGHT }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}

          {/* Day columns (drop zones) */}
          {weekDays.map((d, dayIdx) => {
            const isToday = isSameDay(d, today);
            const dayTasks = tasksByDay.get(dayIdx) ?? [];
            const isDragOver = dragOverCell?.dayIdx === dayIdx;

            return (
              <div
                key={dayIdx}
                className={cn(
                  "relative border-r border-border transition-colors",
                  isToday && "bg-primary/[0.03]",
                  isDragOver && "bg-blue-500/[0.08]"
                )}
                style={{ gridColumn: dayIdx + 2, gridRow: `1 / ${HOURS.length + 1}` }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  const offsetY = e.clientY - rect.top;
                  const rawHour = Math.floor(HOUR_START + offsetY / ROW_HEIGHT);
                  const clampedHour = Math.max(HOUR_START, Math.min(HOUR_END - 1, rawHour));
                  if (!dragOverCell || dragOverCell.dayIdx !== dayIdx || dragOverCell.hour !== clampedHour) {
                    setDragOverCell({ dayIdx, hour: clampedHour });
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCell(null);
                  }
                }}
                onDrop={(e) => handleDrop(e, dayIdx)}
              >
                {/* Hour grid lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-border/50"
                    style={{ top: (hour - HOUR_START) * ROW_HEIGHT + ROW_HEIGHT - 1, height: 1 }}
                  />
                ))}

                {/* Drop indicator line */}
                {isDragOver && dragOverCell && (
                  <div
                    className="absolute inset-x-0 h-0.5 bg-primary z-20 pointer-events-none"
                    style={{ top: (dragOverCell.hour - HOUR_START) * ROW_HEIGHT }}
                  >
                    <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                )}

                {/* Task blocks (draggable) */}
                {dayTasks.map((task) => {
                  const due = new Date(task.dueDate!);
                  const hour = due.getHours();
                  const min = due.getMinutes();
                  const topOffset = (hour - HOUR_START + min / 60) * ROW_HEIGHT;
                  const duration = task.durationMin > 0 ? task.durationMin : 30;
                  const blockHeight = Math.max((duration / 60) * ROW_HEIGHT, 24);
                  const colors = TYPE_COLORS[task.type] ?? TYPE_COLORS.custom;
                  const isDragging = draggingTaskId === task.id;

                  // Skip if outside visible hours
                  if (hour < HOUR_START || hour >= HOUR_END) return null;

                  return (
                    <div
                      key={task.id}
                      className={cn("absolute inset-x-1 group", isDragging && "opacity-40")}
                      style={{ top: topOffset, height: blockHeight }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <button
                        onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                        className={cn(
                          "relative w-full h-full rounded-md border px-1.5 py-0.5 text-left overflow-hidden cursor-grab transition-all",
                          "hover:ring-1 hover:ring-white/20",
                          isDragging && "cursor-grabbing",
                          colors.bg, colors.border
                        )}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs shrink-0">{TASK_TYPE_EMOJI[task.type]}</span>
                          {task.clientName ? (
                            <span className={cn(
                              "font-semibold truncate leading-tight",
                              blockHeight >= 36 ? "text-lg" : "text-xs",
                              colors.text
                            )}>
                              {task.clientName}
                            </span>
                          ) : (
                            <span className={cn(
                              "font-medium truncate",
                              blockHeight >= 36 ? "text-sm" : "text-xs",
                              colors.text
                            )}>
                              {task.title}
                            </span>
                          )}
                        </div>
                        {blockHeight >= 36 && task.clientName && (
                          <div className="text-sm text-muted-foreground truncate">
                            {task.title}
                          </div>
                        )}
                      </button>

                      {/* Popup */}
                      {selectedTask?.id === task.id && (
                        <TaskPopup task={task} onClose={() => setSelectedTask(null)} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
