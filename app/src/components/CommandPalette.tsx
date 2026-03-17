import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Kanban, CheckSquare } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useClients } from "@/features/clients/api/useClients";
import { useDeals } from "@/features/deals/api/useDeals";
import { useTasks } from "@/features/tasks/api/useTasks";
import { cn } from "@/lib/cn";

// ─── Types ──────────────────────────────────────────────────

interface SearchResult {
  id: string;
  label: string;
  secondary?: string;
  category: "clients" | "deals" | "tasks";
  path: string;
}

const CATEGORY_META = {
  clients: { label: "Klienci", icon: Users },
  deals: { label: "Szanse", icon: Kanban },
  tasks: { label: "Zadania", icon: CheckSquare },
} as const;

const MAX_PER_CATEGORY = 5;

// ─── Component ──────────────────────────────────────────────

export function CommandPalette() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ── Data (uses TanStack Query cache) ──
  const { data: clients = [] } = useClients();
  const { data: deals = [] } = useDeals();
  const { data: tasks = [] } = useTasks();

  // ── Global keyboard shortcut ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Focus input on open ──
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Lock body scroll ──
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ── Search logic ──
  const results = useMemo(() => {
    if (!uid || query.length < 2) return [];

    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    // Clients: fullName, phone, email
    for (const c of clients) {
      if (out.filter((r) => r.category === "clients").length >= MAX_PER_CATEGORY) break;
      if (
        c.fullName.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      ) {
        out.push({
          id: c.id,
          label: c.fullName,
          secondary: c.phone || c.email || undefined,
          category: "clients",
          path: `/clients/${c.id}`,
        });
      }
    }

    // Deals: title, clientName
    for (const d of deals) {
      if (out.filter((r) => r.category === "deals").length >= MAX_PER_CATEGORY) break;
      if (d.isRejected || d.isArchived) continue;
      if (
        d.title.toLowerCase().includes(q) ||
        d.clientName?.toLowerCase().includes(q)
      ) {
        out.push({
          id: d.id,
          label: d.title,
          secondary: d.clientName,
          category: "deals",
          path: "/pipeline",
        });
      }
    }

    // Tasks: title, clientName (only open)
    for (const t of tasks) {
      if (out.filter((r) => r.category === "tasks").length >= MAX_PER_CATEGORY) break;
      if (t.status !== "open") continue;
      if (
        t.title.toLowerCase().includes(q) ||
        t.clientName?.toLowerCase().includes(q)
      ) {
        out.push({
          id: t.id,
          label: t.title,
          secondary: t.clientName,
          category: "tasks",
          path: "/tasks",
        });
      }
    }

    return out;
  }, [uid, query, clients, deals, tasks]);

  // ── Navigate to result ──
  const selectResult = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      navigate(result.path);
    },
    [navigate]
  );

  // ── Keyboard nav inside palette ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[activeIndex]) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    },
    [results, activeIndex, selectResult]
  );

  // ── Scroll active item into view ──
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Reset active index on query change ──
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  // Group results by category
  const grouped = (["clients", "deals", "tasks"] as const)
    .map((cat) => ({
      category: cat,
      items: results.filter((r) => r.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Wyszukiwarka"
        className="relative z-10 w-full max-w-md mx-4 rounded-lg border border-border bg-card shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj klientów, szans, zadań..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-2">
          {query.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Wpisz minimum 2 znaki, aby wyszukać...
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Brak wyników dla "{query}"
            </p>
          ) : (
            grouped.map((group) => {
              const meta = CATEGORY_META[group.category];
              const Icon = meta.icon;
              return (
                <div key={group.category} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </div>
                  {group.items.map((item) => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        type="button"
                        onClick={() => selectResult(item)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                          idx === activeIndex
                            ? "bg-accent text-foreground"
                            : "text-foreground/80 hover:bg-accent/50"
                        )}
                      >
                        <span className="font-medium truncate">{item.label}</span>
                        {item.secondary && (
                          <span className="text-xs text-muted-foreground truncate ml-auto">
                            {item.secondary}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>
            <kbd className="font-mono">↑↓</kbd> nawiguj
          </span>
          <span>
            <kbd className="font-mono">Enter</kbd> otwórz
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> zamknij
          </span>
        </div>
      </div>
    </div>
  );
}
