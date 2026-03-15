import { useAuthStore } from "@/store/useAuthStore";
import { useTasks } from "@/features/tasks/api/useTasks";
import { useLeads } from "@/features/leads/api/useLeads";
import { useGoogleIntegration } from "../hooks/useGoogleIntegration";
import { useCalendarAuth } from "@/features/calendar/hooks/useCalendarAuth";
import { useCompleteTask } from "@/features/tasks/api/useUpdateTask";
import {
  TASK_TYPE_EMOJI,
  TASK_TYPE_LABELS,
} from "@/features/tasks/types/task";
import type { TaskDTO } from "@/features/tasks/types/task";
import type { LeadDTO } from "@/features/leads/api/leads";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Phone,
  User,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    maximumFractionDigits: 0,
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

interface StatsProps {
  todayCount: number;
  overdueCount: number;
  newLeadsCount: number;
}

function StatsCards({ todayCount, overdueCount, newLeadsCount }: StatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-5">
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

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-5">
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

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-5">
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

function TodayTimeline({ tasks }: { tasks: TaskDTO[] }) {
  const complete = useCompleteTask();
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
          className="group flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
        >
          {/* Time column */}
          <div className="flex w-14 shrink-0 flex-col items-center">
            <span className="text-xs font-semibold text-primary">
              {formatTime(task.dueDate) || "—"}
            </span>
          </div>

          {/* Vertical line */}
          <div className="flex flex-col items-center pt-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <div className="mt-1 h-full w-px bg-white/[0.08]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">
                {TASK_TYPE_EMOJI[task.type] ?? "📌"}
              </span>
              <h4 className="truncate text-sm font-medium text-foreground">
                {task.title}
              </h4>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
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
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.durationMin} minut
              </span>
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">
                {TASK_TYPE_LABELS[task.type] ?? task.type}
              </span>
            </div>
          </div>

          {/* Complete button */}
          <button
            type="button"
            onClick={() => complete.mutate(task.id)}
            disabled={complete.isPending}
            title="Oznacz jako wykonane"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary/60 transition-all hover:bg-primary hover:text-primary-foreground cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
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
                {task.clientName || "Zadanie ogólne"}
                {task.dueDate &&
                  ` · ${new Date(task.dueDate).toLocaleDateString("pl-PL")}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── New Leads Section ───────────────────────────────────────

function NewLeadsSection({ leads }: { leads: LeadDTO[] }) {
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
          className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
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

      {/* Reauth Banner */}
      <ReauthBanner />

      {/* Stats */}
      <StatsCards
        todayCount={todayTasks.length}
        overdueCount={overdueTasks.length}
        newLeadsCount={newLeads.length}
      />

      {/* Overdue Tasks */}
      <OverdueTasks tasks={overdueTasks} />

      {/* Today timeline */}
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-5">
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
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-5">
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
    </div>
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
