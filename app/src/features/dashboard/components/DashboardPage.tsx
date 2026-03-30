import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useTasks } from "@/features/tasks/api/useTasks";
import { useLeads } from "@/features/leads/api/useLeads";
import { useDeals } from "@/features/deals/api/useDeals";
import { useGoogleIntegration } from "../hooks/useGoogleIntegration";
import { DailyNote } from "./DailyNote";
import { CommissionChart } from "./CommissionChart";
import { useCalendarAuth } from "@/features/calendar/hooks/useCalendarAuth";
import { useCompleteTask, useRescheduleTask } from "@/features/tasks/api/useUpdateTask";
import { useDeleteTask } from "@/features/tasks/api/useDeleteTask";
import {
  TASK_TYPE_EMOJI,
  TASK_TYPE_LABELS,
} from "@/features/tasks/types/task";
import type { TaskDTO } from "@/features/tasks/types/task";
import type { LeadDTO } from "@/features/leads/api/leads";
import type { DealDTO } from "@/features/deals/types/deal";
import { DEAL_STAGE_LABELS } from "@/features/deals/types/deal";
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Phone,
  User,
  X,
  Zap,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";

// ─── Helpers ──────────────────────────────────────────────────

function isSameDay(isoString: string | null, date: Date): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

function isOverdue(isoString: string | null): boolean {
  if (!isoString) return false;
  const now = new Date();
  const dueDate = new Date(isoString);
  // Overdue if due date is before start of today
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  return dueDate < startOfToday;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number | undefined): string {
  if (!amount) return "";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Reauth Banner ──────────────────────────────────────────

function ReauthBanner() {
  const { needsReauth, isLoading } = useGoogleIntegration();
  const { startOAuth, isConnecting } = useCalendarAuth();

  if (isLoading || !needsReauth) return null;

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/40 backdrop-blur-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-300">
            Utracono połączenie z Kalendarzem Google
          </h3>
          <p className="mt-1 text-sm text-red-300/70">
            Autoryzacja wygasła. Odnów połączenie, aby synchronizacja zadań
            działała poprawnie.
          </p>
        </div>
        <Button
          size="sm"
          onClick={startOAuth}
          disabled={isConnecting}
          className="shrink-0 bg-red-500/80 text-white hover:bg-red-500 border-none"
        >
          {isConnecting ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Calendar className="mr-2 h-4 w-4" />
          )}
          Odnów autoryzację
        </Button>
      </div>
    </div>
  );
}

// ─── Stats Cards ─────────────────────────────────────────────

// ─── Month options helper ────────────────────────────────────

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

function buildMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [
    { value: "all", label: "Cały okres" },
  ];
  // Last 12 months + current
  for (let i = 0; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

// ─── Financial Widgets ───────────────────────────────────────

function FinancialWidgets({
  deals,
  selectedMonth,
  onMonthChange,
}: {
  deals: DealDTO[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}) {
  const navigate = useNavigate();
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const stats = useMemo(() => {
    const filtered = selectedMonth === "all"
      ? deals
      : deals.filter((d) => {
          if (d.stage === "wyplata" && d.payoutDate) {
            return d.payoutDate === selectedMonth;
          }
          return d.createdAt?.slice(0, 7) === selectedMonth;
        });

    const active = filtered.filter((d) => d.stage !== "wyplata" && !d.isRejected && !d.isArchived);
    const closed = filtered.filter((d) => d.stage === "wyplata");

    return {
      pipelineValue: active.reduce((sum, d) => sum + d.value, 0),
      closedValue: closed.reduce((sum, d) => sum + (d.commissionValue ?? 0), 0),
      activeCount: active.length,
    };
  }, [deals, selectedMonth]);

  return (
    <div className="space-y-3">
      {/* Month filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5 cursor-pointer transition-all hover:ring-1 hover:ring-primary/30"
          onClick={() => navigate("/pipeline")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <span className="text-lg">💰</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aktywny lejek</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(stats.pipelineValue)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5 cursor-pointer transition-all hover:ring-1 hover:ring-emerald-500/30"
          onClick={() => navigate("/pipeline")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
              <span className="text-lg">🏆</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zamknięte sukcesem</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(stats.closedValue)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5 cursor-pointer transition-all hover:ring-1 hover:ring-blue-500/30"
          onClick={() => navigate("/pipeline")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <span className="text-lg">📂</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aktywne sprawy</p>
              <p className="text-2xl font-bold text-blue-400">{stats.activeCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task Stats ──────────────────────────────────────────────

interface StatsProps {
  todayCount: number;
  overdueCount: number;
  newLeadsCount: number;
}

function StatsCards({ todayCount, overdueCount, newLeadsCount }: StatsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div
        className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5 cursor-pointer transition-all hover:ring-1 hover:ring-primary/30"
        onClick={() => navigate("/tasks")}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Dziś do kontaktu</p>
            <p className="text-2xl font-bold text-foreground">{todayCount}</p>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5 cursor-pointer transition-all hover:ring-1 hover:ring-red-500/30"
        onClick={() => navigate("/tasks")}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Zaległe</p>
            <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5 cursor-pointer transition-all hover:ring-1 hover:ring-amber-500/30"
        onClick={() => navigate("/leads")}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
            <Zap className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Nowe leady</p>
            <p className="text-2xl font-bold text-amber-400">{newLeadsCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Today Tasks Timeline ────────────────────────────────────

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

function RescheduleDialog({
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
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Godzina</Label>
            <Select options={TIME_OPTIONS} value={time} onChange={(e) => setTime(e.target.value)} />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave} disabled={!date || reschedule.isPending}>
            {reschedule.isPending ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}

// ─── Task action buttons (shared) ────────────────────────────

function TaskActionButtons({ task }: { task: TaskDTO }) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const complete = useCompleteTask();
  const del = useDeleteTask();

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => complete.mutate({ taskId: task.id, clientId: task.clientId || null, taskTitle: task.title, taskType: task.type })}
          disabled={complete.isPending}
          title="Oznacz jako wykonane"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 text-emerald-500 transition-all hover:bg-emerald-500 hover:text-white cursor-pointer"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setRescheduleOpen(true)}
          title="Przełóż"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/40 text-amber-500 transition-all hover:bg-amber-500 hover:text-white cursor-pointer"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => del.mutate({ taskId: task.id, googleEventId: task.googleEventId, syncToGoogleCalendar: task.syncToGoogleCalendar })}
          disabled={del.isPending}
          title="Usuń"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 text-red-500 transition-all hover:bg-red-500 hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <RescheduleDialog task={task} open={rescheduleOpen} onOpenChange={setRescheduleOpen} />
    </>
  );
}

function TodayTimeline({ tasks }: { tasks: TaskDTO[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Brak zadań na dziś</p>
        <p className="text-xs opacity-60">Wszystko ogarnięte!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="group flex flex-col gap-2 rounded-lg border border-[var(--surface-6)] bg-[var(--surface-3)] p-3 transition-colors hover:bg-[var(--surface-6)]"
        >
          {/* Row 1: Time + Client */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-semibold text-primary">
              {formatTime(task.dueDate) || "—"}
            </span>
            <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {task.clientName ? (
                task.clientId ? (
                  <a href={`/clients/${task.clientId}`} className="hover:text-blue-400 hover:underline transition-colors">
                    {task.clientName}
                  </a>
                ) : (
                  task.clientName
                )
              ) : (
                <span className="italic text-muted-foreground">Zadanie ogólne</span>
              )}
            </span>
          </div>

          {/* Row 2: Task type + Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="text-base shrink-0">
                {TASK_TYPE_EMOJI[task.type] ?? "📌"}
              </span>
              <span className="truncate">{task.title}</span>
              <span className="shrink-0 rounded-md bg-[var(--surface-6)] px-1.5 py-0.5">
                {TASK_TYPE_LABELS[task.type] ?? task.type}
              </span>
              <span className="hidden sm:flex shrink-0 items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.durationMin} minut
              </span>
            </div>
            <TaskActionButtons task={task} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Overdue Tasks ───────────────────────────────────────────

function OverdueTasks({ tasks }: { tasks: TaskDTO[] }) {
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-950/20 backdrop-blur-xl p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-300">
        <AlertTriangle className="h-4 w-4" />
        Zaległe zadania
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-lg border border-red-500/10 bg-red-950/30 p-3"
          >
            <span className="text-base">
              {TASK_TYPE_EMOJI[task.type] ?? "📌"}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="truncate text-sm font-medium text-red-200">
                {task.title}
              </h4>
              <p className="text-xs text-red-300/60">
                {task.clientId ? (
                  <a href={`/clients/${task.clientId}`} className="hover:text-red-200 hover:underline transition-colors">
                    {task.clientName || "Zadanie ogólne"}
                  </a>
                ) : (
                  "Zadanie ogólne"
                )}
                {task.dueDate &&
                  ` · ${new Date(task.dueDate).toLocaleDateString("pl-PL")}`}
              </p>
            </div>
            <TaskActionButtons task={task} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── New Leads Section ───────────────────────────────────────

function NewLeadsSection({ leads }: { leads: LeadDTO[] }) {
  const navigate = useNavigate();

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Zap className="mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm">Brak nowych leadów</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {leads.map((lead) => (
        <div
          key={lead.id}
          className="group flex items-center gap-3 rounded-lg border border-[var(--surface-6)] bg-[var(--surface-3)] p-3 transition-colors hover:bg-[var(--surface-6)] cursor-pointer"
          onClick={() => navigate("/leads")}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <User className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="truncate text-sm font-medium text-foreground">
              {lead.fullName}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </span>
              )}
              {lead.estimatedAmount && (
                <span>{formatCurrency(lead.estimatedAmount)}</span>
              )}
            </div>
          </div>
          <div className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
            Nowy
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────

export function DashboardPage() {
  const profile = useAuthStore((s) => s.profile);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: deals = [] } = useDeals();

  // F1: month filter for financial widgets (default: current YYYY-MM)
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [finMonth, setFinMonth] = useState(currentMonth);

  const today = new Date();

  const todayTasks = tasks
    .filter((t) => t.status === "open" && isSameDay(t.dueDate, today))
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const overdueTasks = tasks.filter(
    (t) => t.status === "open" && isOverdue(t.dueDate)
  );

  const newLeads = leads.filter((l) => l.status === "new");

  const greeting = getGreeting();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, {profile?.displayName?.split(" ")[0] ?? "Użytkowniku"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {today.toLocaleDateString("pl-PL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      {/* Daily Note */}
      <DailyNote />

      {/* Reauth Banner */}
      <ReauthBanner />

      {/* Financial Widgets */}
      <FinancialWidgets
        deals={deals}
        selectedMonth={finMonth}
        onMonthChange={setFinMonth}
      />

      {/* Commission Chart */}
      <CommissionChart deals={deals} />

      {/* Task Stats */}
      <StatsCards
        todayCount={todayTasks.length}
        overdueCount={overdueTasks.length}
        newLeadsCount={newLeads.length}
      />

      {/* Overdue Tasks */}
      <OverdueTasks tasks={overdueTasks} />

      {/* Today timeline */}
      <section className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          Dziś do kontaktu
        </h2>
        {tasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TodayTimeline tasks={todayTasks} />
        )}
      </section>

      {/* New Leads */}
      <section className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Zap className="h-4 w-4 text-amber-400" />
          Nowe leady — czekają na pierwszy kontakt
        </h2>
        {leadsLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <NewLeadsSection leads={newLeads} />
        )}
      </section>

      {/* Recent Activity */}
      <RecentActivity deals={deals} tasks={tasks} />
    </div>
  );
}

// ─── Recent Activity (F2) ────────────────────────────────────

interface ActivityItem {
  id: string;
  icon: string;
  label: string;
  detail?: string;
  timestamp: string; // ISO
}

function RecentActivity({
  deals,
  tasks,
}: {
  deals: DealDTO[];
  tasks: TaskDTO[];
}) {
  const items = useMemo(() => {
    const out: ActivityItem[] = [];

    // Tasks: completed or cancelled recently
    for (const t of tasks) {
      if (t.status === "done" && t.completedAt) {
        out.push({
          id: `task-done-${t.id}`,
          icon: "✓",
          label: t.title,
          detail: `Wykonane — ${t.clientName}`,
          timestamp: t.completedAt,
        });
      }
      if ((t.status === "cancelled" || t.status === "system_cancelled") && t.updatedAt) {
        out.push({
          id: `task-cancel-${t.id}`,
          icon: "✗",
          label: t.title,
          detail: `Anulowane — ${t.clientName}`,
          timestamp: t.updatedAt,
        });
      }
    }

    // Deals: stage changes from history
    for (const d of deals) {
      if (d.history?.length > 0) {
        const latest = d.history[d.history.length - 1];
        out.push({
          id: `deal-stage-${d.id}`,
          icon: "📊",
          label: d.title,
          detail: `${DEAL_STAGE_LABELS[latest.stage]} — ${d.clientName ?? ""}`,
          timestamp: latest.timestamp,
        });
      }
      if (d.isRejected && d.history?.length > 0) {
        out.push({
          id: `deal-reject-${d.id}`,
          icon: "🚫",
          label: d.title,
          detail: `Odrzucono — ${d.clientName ?? ""}`,
          timestamp: d.history[d.history.length - 1].timestamp,
        });
      }
    }

    // Sort by timestamp desc, take 10
    out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return out.slice(0, 10);
  }, [deals, tasks]);

  if (items.length === 0) return null;

  function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "teraz";
    if (mins < 60) return `${mins} min temu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) {
      if (hrs === 1) return "1 godzinę temu";
      if (hrs < 5) return `${hrs} godziny temu`;
      return `${hrs} godzin temu`;
    }
    const days = Math.floor(hrs / 24);
    if (days === 1) return "wczoraj";
    if (days < 5) return `${days} dni temu`;
    return `${days} dni temu`;
  }

  return (
    <section className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Activity className="h-4 w-4 text-violet-400" />
        Ostatnia aktywność
      </h2>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-4)] transition-colors"
          >
            <span className="text-base shrink-0 w-6 text-center">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground truncate block">{item.label}</span>
              {item.detail && (
                <span className="text-xs text-muted-foreground truncate block">{item.detail}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {formatRelative(item.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Greeting based on time of day ───────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Dobrej nocy";
  if (hour < 12) return "Dzień dobry";
  if (hour < 18) return "Cześć";
  return "Dobry wieczór";
}
