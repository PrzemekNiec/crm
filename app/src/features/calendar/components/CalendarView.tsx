import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/useAuthStore";
import { useTasks } from "@/features/tasks/api/useTasks";
import { useCompleteTask, useRescheduleTask, useUpdateTaskDetails } from "@/features/tasks/api/useUpdateTask";
import { useDeleteTask } from "@/features/tasks/api/useDeleteTask";
import { tasksQueryKey } from "@/features/tasks/api/tasks";
import { TASK_TYPE_EMOJI, TASK_TYPES, TASK_TYPE_LABELS } from "@/features/tasks/types/task";
import type { TaskDTO } from "@/features/tasks/types/task";
import { CreateTaskDialog } from "@/features/tasks/components/CreateTaskDialog";
import { cn } from "@/lib/cn";
import { getDb } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

// ─── Constants ──────────────────────────────────────────────

const HOUR_START = 6;
const HOUR_END = 21;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const ROW_HEIGHT = 60; // px per hour
const DAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const DAY_NAMES_SHORT = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  call:     { bg: "bg-pink-500/20",    border: "border-pink-500/40",    text: "text-pink-700 dark:text-pink-300" },
  meeting:  { bg: "bg-red-500/20",     border: "border-red-500/40",     text: "text-red-700 dark:text-red-300" },
  followup: { bg: "bg-amber-500/20",   border: "border-amber-500/40",   text: "text-amber-700 dark:text-amber-300" },
  docs:     { bg: "bg-blue-500/20",    border: "border-blue-500/40",    text: "text-blue-700 dark:text-blue-300" },
  check:    { bg: "bg-purple-500/20",  border: "border-purple-500/40",  text: "text-purple-700 dark:text-purple-300" },
  custom:   { bg: "bg-gray-500/20",    border: "border-gray-500/40",    text: "text-gray-700 dark:text-gray-300" },
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
  const rescheduleTask = useRescheduleTask();
  const updateDetails = useUpdateTaskDetails();
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();
  const popupRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  // Editable time state
  const [editTime, setEditTime] = useState(() =>
    dueDate
      ? `${String(dueDate.getHours()).padStart(2, "0")}:${String(dueDate.getMinutes()).padStart(2, "0")}`
      : "09:00"
  );
  const [editDuration, setEditDuration] = useState(task.durationMin || 30);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const [followUpOpen, setFollowUpOpen] = useState(false);

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      deleteTask.mutate({
        taskId: task.id,
        googleEventId: task.googleEventId,
        syncToGoogleCalendar: task.syncToGoogleCalendar,
      });
      onClose();
    } else {
      setConfirmDelete(true);
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  // Inline edit states
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);

  const saveTitle = () => {
    const trimmed = titleVal.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === task.title) {
      setTitleVal(task.title);
      return;
    }
    if (uid) {
      qc.setQueryData<TaskDTO[]>(tasksQueryKey(uid), (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, title: trimmed } : t))
      );
    }
    updateDetails.mutate({
      taskId: task.id,
      title: trimmed,
      syncToGoogleCalendar: task.syncToGoogleCalendar,
      dueDate: task.dueDate,
      description: task.description,
      durationMin: task.durationMin,
      googleEventId: task.googleEventId,
      type: task.type,
    });
  };

  const handleTypeChange = (newType: string) => {
    if (newType === task.type) return;
    if (uid) {
      qc.setQueryData<TaskDTO[]>(tasksQueryKey(uid), (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, type: newType as TaskDTO["type"] } : t))
      );
    }
    updateDetails.mutate({
      taskId: task.id,
      type: newType,
      syncToGoogleCalendar: task.syncToGoogleCalendar,
      dueDate: task.dueDate,
      description: task.description,
      durationMin: task.durationMin,
      googleEventId: task.googleEventId,
      title: task.title,
    });
  };

  const colors = TYPE_COLORS[task.type] ?? TYPE_COLORS.custom;

  const handleSaveTime = () => {
    if (!dueDate || !uid) return;
    const [h, m] = editTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;

    const newDate = new Date(dueDate);
    newDate.setHours(h, m, 0, 0);
    const newDueDate = newDate.toISOString();
    const oldDueDate = task.dueDate;
    const oldDuration = task.durationMin;

    // Check if anything changed
    if (newDueDate === oldDueDate && editDuration === oldDuration) return;

    // Optimistic update
    qc.setQueryData<TaskDTO[]>(tasksQueryKey(uid), (old) =>
      old?.map((t) => (t.id === task.id ? { ...t, dueDate: newDueDate, durationMin: editDuration } : t))
    );

    // Persist time change
    rescheduleTask.mutate(
      {
        taskId: task.id,
        dueDate: newDueDate,
        title: task.title,
        description: task.description,
        durationMin: editDuration,
        googleEventId: task.googleEventId,
        syncToGoogleCalendar: task.syncToGoogleCalendar,
        type: task.type,
      },
      {
        onError: () => {
          qc.setQueryData<TaskDTO[]>(tasksQueryKey(uid), (old) =>
            old?.map((t) => (t.id === task.id ? { ...t, dueDate: oldDueDate, durationMin: oldDuration } : t))
          );
        },
      }
    );

    // Also update durationMin in Firestore (reschedule only updates dueAt)
    if (editDuration !== oldDuration) {
      const db = getDb();
      const ref = doc(db, "users", uid, "tasks", task.id);
      updateDoc(ref, { durationMin: editDuration, updatedAt: serverTimestamp() });
    }

    onClose();
  };

  return (
    <div
      ref={popupRef}
      className={cn(
        "z-30 rounded-lg border border-border bg-card p-4 shadow-xl",
        "fixed inset-x-3 bottom-20",
        "md:absolute md:inset-x-auto md:bottom-auto md:top-0 md:w-72 md:right-[calc(100%+8px)]"
      )}
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
            {task.status === "open" ? (
              <select
                value={task.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                disabled={updateDetails.isPending}
                className="text-sm bg-transparent border-none outline-none cursor-pointer p-0 appearance-none"
                title="Zmień typ zadania"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{TASK_TYPE_EMOJI[t]} {TASK_TYPE_LABELS[t]}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm">{TASK_TYPE_EMOJI[task.type]} {TASK_TYPE_LABELS[task.type]}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Editable title — full width */}
      {editingTitle ? (
        <textarea
          ref={titleInputRef}
          value={titleVal}
          onChange={(e) => setTitleVal(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTitle(); }
            if (e.key === "Escape") { setTitleVal(task.title); setEditingTitle(false); }
          }}
          disabled={updateDetails.isPending}
          rows={2}
          className="w-full text-sm text-foreground bg-[var(--surface-6)] border border-[var(--surface-8)] rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 resize-none mb-2"
          autoFocus
        />
      ) : (
        <p
          className={cn(
            "text-sm text-muted-foreground mb-2",
            task.status === "open" && "cursor-pointer hover:text-foreground hover:bg-[var(--surface-5)] rounded px-1 -mx-1 py-0.5 transition-colors"
          )}
          onClick={() => {
            if (task.status !== "open") return;
            setEditingTitle(true);
            setTimeout(() => titleInputRef.current?.focus(), 0);
          }}
          title={task.status === "open" ? "Kliknij, aby edytować tytuł" : undefined}
        >
          {task.title}
        </p>
      )}

      {dueDate && (
        <p className="text-xs text-muted-foreground mb-2">
          {dueDate.toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}

      {task.description && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Time & Duration editors */}
      {task.status === "open" && dueDate && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">Godzina</label>
            <input
              type="time"
              value={editTime}
              step={900}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="w-24">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">Czas trwania</label>
            <select
              value={editDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 godz</option>
              <option value={90}>1,5 godz</option>
              <option value={120}>2 godz</option>
              <option value={180}>3 godz</option>
            </select>
          </div>
          <div className="pt-3.5">
            <Button size="sm" variant="outline" className="text-xs px-2" onClick={handleSaveTime}>
              Zapisz
            </Button>
          </div>
        </div>
      )}

      <div className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium mb-3 border", colors.bg, colors.border, colors.text)}>
        {TASK_TYPE_LABELS[task.type] ?? task.type}
        {task.durationMin > 0 && ` · ${task.durationMin} min`}
      </div>

      {task.status === "open" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-xs"
              onClick={() => { completeTask.mutate({ taskId: task.id, clientId: task.clientId || null, taskTitle: task.title, taskType: task.type }); onClose(); }}
            >
              Ukończ
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "flex-1 text-xs transition-all",
                confirmDelete
                  ? "bg-red-500 text-white border-red-500 animate-pulse"
                  : "text-red-400 border-red-500/30 hover:bg-red-500/10"
              )}
              onClick={handleDeleteClick}
            >
              {confirmDelete ? "Na pewno?" : "Usuń"}
            </Button>
          </div>
          <Button
            size="sm"
            variant="default"
            className="w-full text-xs gap-1.5"
            onClick={() => {
              completeTask.mutate(
                { taskId: task.id, clientId: task.clientId || null, taskTitle: task.title, taskType: task.type },
                { onSuccess: () => { onClose(); setFollowUpOpen(true); } }
              );
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Ukończ i zaplanuj kolejne
          </Button>
        </div>
      )}

      <CreateTaskDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        defaultClientId={task.clientId || undefined}
        defaultClientName={task.clientName || undefined}
        defaultType={task.type}
        defaultDueDate={(() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dd = tomorrow.toISOString().split("T")[0];
          const time = task.dueDate?.split("T")[1]?.slice(0, 5) ?? "09:00";
          return `${dd}T${time}`;
        })()}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function CalendarView() {
  const { data: tasks = [] } = useTasks();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedTask, setSelectedTask] = useState<TaskDTO | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ dayIdx: number; minutes: number } | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Click-to-create state
  const [createOpen, setCreateOpen] = useState(false);
  const [slotDate, setSlotDate] = useState<string>("");
  const [slotDuration, setSlotDuration] = useState<number | undefined>(undefined);
  const [slotSelect, setSlotSelect] = useState<{ dayIdx: number; startMin: number; endMin: number } | null>(null);
  const slotSelectRef = useRef<{ dayIdx: number; startMin: number } | null>(null);

  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();
  const reschedule = useRescheduleTask();

  const today = new Date();

  // ─── Mobile day view ──────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [mobileDayIdx, setMobileDayIdx] = useState(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  });
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    setIsMobile(!mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Cancel slot selection if mouse released outside grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (slotSelectRef.current) {
        slotSelectRef.current = null;
        setSlotSelect(null);
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

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

  const goToday = useCallback(() => {
    setWeekStart(getMonday(new Date()));
    const day = new Date().getDay();
    setMobileDayIdx(day === 0 ? 6 : day - 1);
  }, []);
  const goPrev = useCallback(() => setWeekStart((w) => addDays(w, -7)), []);
  const goNext = useCallback(() => setWeekStart((w) => addDays(w, 7)), []);

  const goPrevDay = useCallback(() => {
    setMobileDayIdx((prev) => {
      if (prev === 0) {
        setWeekStart((w) => addDays(w, -7));
        return 6;
      }
      return prev - 1;
    });
  }, []);

  const goNextDay = useCallback(() => {
    setMobileDayIdx((prev) => {
      if (prev === 6) {
        setWeekStart((w) => addDays(w, 7));
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goPrevDay();
      else goNextDay();
    }
  }, [goPrevDay, goNextDay]);

  const mobileDay = weekDays[mobileDayIdx];
  const visibleDays = isMobile
    ? [{ date: mobileDay, dayIdx: mobileDayIdx, colIdx: 2 }]
    : weekDays.map((d, i) => ({ date: d, dayIdx: i, colIdx: i + 2 }));

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

  // ─── Click-to-create handlers ─────────────────────────────

  const calcMinutesFromY = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const rawMinutes = (offsetY / ROW_HEIGHT) * 60;
    return Math.round(rawMinutes / 15) * 15; // snap to 15min
  }, []);

  const handleSlotMouseDown = useCallback((e: React.MouseEvent, dayIdx: number) => {
    if (e.button !== 0 || draggingTaskId) return;
    // Ignore clicks on task blocks
    if ((e.target as HTMLElement).closest("[draggable]")) return;
    e.preventDefault();
    const minutes = calcMinutesFromY(e);
    slotSelectRef.current = { dayIdx, startMin: minutes };
    setSlotSelect({ dayIdx, startMin: minutes, endMin: minutes + 15 });
  }, [draggingTaskId, calcMinutesFromY]);

  const handleSlotMouseMove = useCallback((e: React.MouseEvent, dayIdx: number) => {
    const ref = slotSelectRef.current;
    if (!ref || ref.dayIdx !== dayIdx) return;
    const currentMin = calcMinutesFromY(e);
    const startMin = Math.min(ref.startMin, currentMin);
    const endMin = Math.max(ref.startMin, currentMin) + 15; // at least 15min block
    setSlotSelect({ dayIdx, startMin, endMin });
  }, [calcMinutesFromY]);

  const handleSlotMouseUp = useCallback((e: React.MouseEvent, dayIdx: number) => {
    const ref = slotSelectRef.current;
    slotSelectRef.current = null;
    if (!ref || ref.dayIdx !== dayIdx || draggingTaskId) return;

    const endMinutes = calcMinutesFromY(e);
    const startMin = Math.min(ref.startMin, endMinutes);
    const endMin = Math.max(ref.startMin, endMinutes) + 15;
    const diffMin = endMin - startMin;

    // Build datetime from start of selection
    const targetDay = weekDays[dayIdx];
    const hours = HOUR_START + Math.floor(startMin / 60);
    const mins = startMin % 60;
    const dateStr = `${targetDay.getFullYear()}-${String(targetDay.getMonth() + 1).padStart(2, "0")}-${String(targetDay.getDate()).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

    setSlotDate(dateStr);
    setSlotDuration(diffMin >= 15 ? diffMin : undefined);
    setSlotSelect(null);
    setCreateOpen(true);
  }, [weekDays, draggingTaskId, calcMinutesFromY]);

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
      <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-6 border-b border-border shrink-0">
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground capitalize">
            {formatMonthYear(weekStart)}
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Dziś</Button>
          <Button variant="ghost" size="sm" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Mobile */}
        <div className="flex md:hidden items-center flex-1 min-w-0">
          <Button variant="ghost" size="sm" className="shrink-0" onClick={goPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-bold text-foreground capitalize text-center flex-1 truncate">
            {mobileDay.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
          </h1>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={goNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="md:hidden">
          <Button variant="outline" size="sm" onClick={goToday}>Dziś</Button>
        </div>
      </div>

      {/* Day headers (desktop only) */}
      <div className="hidden md:grid shrink-0" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        {/* Gutter */}
        <div className="border-b border-r border-[var(--grid-line)]" />
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className={cn(
                "border-b border-r border-[var(--grid-line)] px-2 py-2 text-center",
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
      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <div className="grid relative" style={{ gridTemplateColumns: isMobile ? "40px 1fr" : "56px repeat(7, 1fr)", minHeight: HOURS.length * ROW_HEIGHT }}>
          {/* Hour labels + horizontal lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-b border-r border-[var(--grid-line)] text-[11px] text-muted-foreground pr-2 pt-1 text-right col-start-1"
              style={{ gridRow: hour - HOUR_START + 1, height: ROW_HEIGHT }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}

          {/* Day columns (drop zones) */}
          {visibleDays.map(({ date: d, dayIdx, colIdx }) => {
            const isToday = isSameDay(d, today);
            const dayTasks = tasksByDay.get(dayIdx) ?? [];
            const isDragOver = dragOverCell?.dayIdx === dayIdx;

            return (
              <div
                key={dayIdx}
                className={cn(
                  "relative border-r border-[var(--grid-line)] transition-colors",
                  isToday && "bg-primary/[0.03]",
                  isDragOver && "bg-blue-500/[0.08]"
                )}
                style={{ gridColumn: colIdx, gridRow: `1 / ${HOURS.length + 1}` }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  const offsetY = e.clientY - rect.top;
                  const rawMinutes = (offsetY / ROW_HEIGHT) * 60;
                  const snappedMin = Math.round(rawMinutes / 15) * 15;
                  const clampedMin = Math.max(0, Math.min((HOUR_END - HOUR_START) * 60 - 15, snappedMin));
                  if (!dragOverCell || dragOverCell.dayIdx !== dayIdx || dragOverCell.minutes !== clampedMin) {
                    setDragOverCell({ dayIdx, minutes: clampedMin });
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCell(null);
                  }
                }}
                onDrop={(e) => handleDrop(e, dayIdx)}
                onMouseDown={(e) => handleSlotMouseDown(e, dayIdx)}
                onMouseMove={(e) => handleSlotMouseMove(e, dayIdx)}
                onMouseUp={(e) => handleSlotMouseUp(e, dayIdx)}
              >
                {/* Hour grid lines + 15-min sub-lines */}
                {HOURS.map((hour) => (
                  <div key={hour}>
                    {/* Full hour line */}
                    <div
                      className="absolute w-full border-b border-[var(--grid-line)]"
                      style={{ top: (hour - HOUR_START) * ROW_HEIGHT + ROW_HEIGHT - 1, height: 1 }}
                    />
                    {/* 15-min sub-lines */}
                    {[1, 2, 3].map((q) => (
                      <div
                        key={q}
                        className="absolute w-full border-b border-[var(--grid-subline)]"
                        style={{ top: (hour - HOUR_START) * ROW_HEIGHT + (q * ROW_HEIGHT) / 4 - 1, height: 1 }}
                      />
                    ))}
                  </div>
                ))}

                {/* Slot selection highlight */}
                {slotSelect && slotSelect.dayIdx === dayIdx && (
                  <div
                    className="absolute inset-x-0 bg-primary/20 border border-primary/40 rounded-md z-10 pointer-events-none"
                    style={{
                      top: (slotSelect.startMin / 60) * ROW_HEIGHT,
                      height: Math.max(((slotSelect.endMin - slotSelect.startMin) / 60) * ROW_HEIGHT, 15),
                    }}
                  >
                    <span className="absolute left-1.5 top-0.5 text-[10px] font-medium text-primary">
                      {String(HOUR_START + Math.floor(slotSelect.startMin / 60)).padStart(2, "0")}:
                      {String(slotSelect.startMin % 60).padStart(2, "0")}
                      {" — "}
                      {String(HOUR_START + Math.floor(slotSelect.endMin / 60)).padStart(2, "0")}:
                      {String(slotSelect.endMin % 60).padStart(2, "0")}
                    </span>
                  </div>
                )}

                {/* Drop indicator line */}
                {isDragOver && dragOverCell && (
                  <div
                    className="absolute inset-x-0 h-0.5 bg-primary z-20 pointer-events-none"
                    style={{ top: (dragOverCell.minutes / 60) * ROW_HEIGHT }}
                  >
                    <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="absolute left-3 -top-3 text-[10px] font-medium text-primary bg-card/90 px-1 rounded">
                      {String(HOUR_START + Math.floor(dragOverCell.minutes / 60)).padStart(2, "0")}:
                      {String(dragOverCell.minutes % 60).padStart(2, "0")}
                    </span>
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

      {/* Click-to-create dialog */}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDueDate={slotDate}
        defaultDurationMin={slotDuration}
      />
    </div>
  );
}
