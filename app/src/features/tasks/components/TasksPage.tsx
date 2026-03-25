import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTasks } from "../api/useTasks";
import { TaskList } from "./TaskList";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { cn } from "@/lib/cn";
import { GLASS } from "@/lib/glass";

type Tab = "today" | "overdue" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Dziś" },
  { key: "overdue", label: "Zaległe" },
  { key: "all", label: "Wszystkie" },
];

export function TasksPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: tasks, isLoading } = useTasks();

  // Count badges
  const todayCount = tasks?.filter(
    (t) =>
      t.status === "open" &&
      t.dueDate &&
      new Date(t.dueDate).toDateString() === new Date().toDateString()
  ).length ?? 0;

  const overdueCount = tasks?.filter((t) => {
    if (t.status !== "open" || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d < now && d.toDateString() !== now.toDateString();
  }).length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Zadania</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Dodaj zadanie</span>
        </Button>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={GLASS}
      >
        {TABS.map(({ key, label }) => {
          const count =
            key === "today" ? todayCount : key === "overdue" ? overdueCount : (tasks?.length ?? 0);

          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer flex-1 justify-center",
                tab === key
                  ? "bg-[var(--surface-8)] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    tab === key
                      ? key === "overdue"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <TaskList tasks={tasks} isLoading={isLoading} tab={tab} />

      {/* Create dialog */}
      <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
