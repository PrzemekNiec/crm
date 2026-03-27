import { useState } from "react";
import { Plus, Zap, Users, Briefcase, CheckSquare, X } from "lucide-react";
import { CreateLeadDialog } from "@/features/leads/components/CreateLeadDialog";
import { CreateClientDialog } from "@/features/clients/components/CreateClientDialog";
import { AddDealDialog } from "@/features/deals/components/PipelinePage";
import { CreateTaskDialog } from "@/features/tasks/components/CreateTaskDialog";

// ─── Speed-dial action items ─────────────────────────────────

const ACTIONS = [
  {
    key: "lead" as const,
    label: "Nowy Potencjalny",
    icon: Zap,
    color: "bg-amber-500 text-white",
  },
  {
    key: "client" as const,
    label: "Nowy Klient",
    icon: Users,
    color: "bg-blue-500 text-white",
  },
  {
    key: "deal" as const,
    label: "Nowa Szansa",
    icon: Briefcase,
    color: "bg-violet-500 text-white",
  },
  {
    key: "task" as const,
    label: "Nowe Zadanie",
    icon: CheckSquare,
    color: "bg-emerald-500 text-white",
  },
] as const;

type ActionKey = (typeof ACTIONS)[number]["key"];

// ─── Component ───────────────────────────────────────────────

export function MobileFAB() {
  const [expanded, setExpanded] = useState(false);
  const [openDialog, setOpenDialog] = useState<ActionKey | null>(null);

  const handleAction = (key: ActionKey) => {
    setExpanded(false);
    setOpenDialog(key);
  };

  return (
    <>
      {/* Backdrop when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 md:hidden"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Speed dial menu */}
      <div className="fixed bottom-20 right-4 z-[80] flex flex-col items-end gap-3 md:hidden">
        {/* Action buttons — animate in from bottom */}
        {expanded &&
          ACTIONS.map((action, i) => (
            <button
              key={action.key}
              type="button"
              onClick={() => handleAction(action.key)}
              className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
            >
              <span className="rounded-lg bg-background/90 border border-border px-3 py-1.5 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm">
                {action.label}
              </span>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg ${action.color}`}
              >
                <action.icon className="h-4 w-4" />
              </span>
            </button>
          ))}

        {/* Main FAB button */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95"
        >
          {expanded ? (
            <X className="h-6 w-6 transition-transform" />
          ) : (
            <Plus className="h-6 w-6 transition-transform" />
          )}
        </button>
      </div>

      {/* Dialogs */}
      <CreateLeadDialog
        open={openDialog === "lead"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
      />
      <CreateClientDialog
        open={openDialog === "client"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
      />
      <AddDealDialog
        open={openDialog === "deal"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
      />
      <CreateTaskDialog
        open={openDialog === "task"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
      />
    </>
  );
}
