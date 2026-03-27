import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search, Users, Zap, Briefcase, CheckSquare } from "lucide-react";
import { useClients } from "@/features/clients/api/useClients";
import { useLeads } from "@/features/leads/api/useLeads";
import { useDeals } from "@/features/deals/api/useDeals";
import { useTasks } from "@/features/tasks/api/useTasks";
import { GLASS } from "@/lib/glass";

// ─── Types ───────────────────────────────────────────────────

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  category: "client" | "lead" | "deal" | "task";
  route: string;
}

const CATEGORY_META: Record<
  SearchResult["category"],
  { label: string; icon: typeof Users; color: string }
> = {
  client: { label: "Klienci", icon: Users, color: "text-blue-400" },
  lead: { label: "Potencjalni", icon: Zap, color: "text-amber-400" },
  deal: { label: "Szanse", icon: Briefcase, color: "text-violet-400" },
  task: { label: "Zadania", icon: CheckSquare, color: "text-emerald-400" },
};

const MAX_RESULTS_PER_CATEGORY = 5;

// ─── Component ───────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Data hooks
  const { data: clients = [] } = useClients();
  const { data: leads = [] } = useLeads();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();

  // ─── Keyboard shortcut (Ctrl+K / Cmd+K) ───────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const handleCustom = () => setOpen(true);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("open-global-search", handleCustom);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("open-global-search", handleCustom);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ─── Build search results ─────────────────────────────────

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches: SearchResult[] = [];

    // Clients
    for (const c of clients) {
      if (
        c.fullName.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      ) {
        matches.push({
          id: `client-${c.id}`,
          label: c.fullName,
          sublabel: [c.phone, c.email].filter(Boolean).join(" · "),
          category: "client",
          route: `/clients/${c.id}`,
        });
      }
      if (matches.filter((m) => m.category === "client").length >= MAX_RESULTS_PER_CATEGORY) break;
    }

    // Leads
    for (const l of leads) {
      if (
        l.fullName.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q)
      ) {
        matches.push({
          id: `lead-${l.id}`,
          label: l.fullName,
          sublabel: l.phone || undefined,
          category: "lead",
          route: "/leads",
        });
      }
      if (matches.filter((m) => m.category === "lead").length >= MAX_RESULTS_PER_CATEGORY) break;
    }

    // Deals
    for (const d of deals) {
      if (
        d.title.toLowerCase().includes(q) ||
        d.clientName?.toLowerCase().includes(q)
      ) {
        matches.push({
          id: `deal-${d.id}`,
          label: d.title,
          sublabel: d.clientName || undefined,
          category: "deal",
          route: "/pipeline",
        });
      }
      if (matches.filter((m) => m.category === "deal").length >= MAX_RESULTS_PER_CATEGORY) break;
    }

    // Tasks
    for (const t of tasks) {
      if (
        t.title.toLowerCase().includes(q) ||
        t.clientName?.toLowerCase().includes(q)
      ) {
        matches.push({
          id: `task-${t.id}`,
          label: t.title,
          sublabel: t.clientName || undefined,
          category: "task",
          route: "/tasks",
        });
      }
      if (matches.filter((m) => m.category === "task").length >= MAX_RESULTS_PER_CATEGORY) break;
    }

    return matches;
  }, [query, clients, leads, deals, tasks]);

  // ─── Grouped results ──────────────────────────────────────

  const grouped = useMemo(() => {
    const groups: { category: SearchResult["category"]; items: SearchResult[] }[] = [];
    const seen = new Set<string>();

    for (const r of results) {
      if (!seen.has(r.category)) {
        seen.add(r.category);
        groups.push({ category: r.category, items: [] });
      }
      groups.find((g) => g.category === r.category)!.items.push(r);
    }

    return groups;
  }, [results]);

  // Flat list for keyboard nav
  const flatResults = useMemo(() => results, [results]);

  // ─── Navigation handlers ──────────────────────────────────

  const goTo = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      navigate(result.route);
    },
    [navigate]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && flatResults[selectedIdx]) {
      e.preventDefault();
      goTo(flatResults[selectedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // ─── Render ───────────────────────────────────────────────

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[15vh] z-[100] mx-auto max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={GLASS}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Szukaj klientów, leadów, szans, zadań…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim() && flatResults.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Brak wyników dla "{query}"
            </p>
          )}

          {!query.trim() && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Zacznij pisać, aby wyszukać…
            </p>
          )}

          {grouped.map((group) => {
            const meta = CATEGORY_META[group.category];
            const Icon = meta.icon;

            return (
              <div key={group.category} className="mb-1">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {meta.label}
                  </span>
                </div>

                {group.items.map((item) => {
                  const idx = flatResults.indexOf(item);
                  const isSelected = idx === selectedIdx;

                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      type="button"
                      onClick={() => goTo(item)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "text-foreground/80 hover:bg-primary/5"
                      }`}
                    >
                      <span className="text-sm font-medium truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.sublabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        {flatResults.length > 0 && (
          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd> nawiguj
            </span>
            <span>
              <kbd className="rounded border border-border px-1 py-0.5">Enter</kbd> otwórz
            </span>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
