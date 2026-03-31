import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, User } from "lucide-react";
import { useClients } from "@/features/clients/api/useClients";
import { cn } from "@/lib/cn";

// ─── Types ──────────────────────────────────────────────────

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

interface ClientComboboxProps {
  value: string;
  onChange: (clientId: string, clientName: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}

// ─── Component ──────────────────────────────────────────────

export function ClientCombobox({
  value,
  onChange,
  placeholder = "Szukaj klienta...",
  allowEmpty = true,
  emptyLabel = "Zadanie ogólne (brak klienta)",
  disabled = false,
}: ClientComboboxProps) {
  const { data: clients = [] } = useClients();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected client display name
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === value),
    [clients, value]
  );

  // Filtered results
  const filtered = useMemo(() => {
    if (query.length === 0) return clients;
    const q = query.toLowerCase();
    return clients.filter(
      (c: ClientOption) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clients, query]);

  // Reset active index on filter change
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current || !open) return;
    const item = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const selectClient = useCallback(
    (client: ClientOption | null) => {
      if (client) {
        onChange(client.id, `${client.firstName} ${client.lastName}`);
        setQuery("");
      } else {
        onChange("", "");
        setQuery("");
      }
      setOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const totalItems = (allowEmpty ? 1 : 0) + filtered.length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (allowEmpty && activeIndex === 0) {
          selectClient(null);
        } else {
          const idx = allowEmpty ? activeIndex - 1 : activeIndex;
          if (filtered[idx]) selectClient(filtered[idx]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", "");
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-input bg-[var(--surface-6)] px-3 py-2 text-sm transition-colors",
          open && "ring-2 ring-primary/50",
          disabled && "opacity-50 pointer-events-none"
        )}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none min-w-0"
          />
        ) : (
          <span
            className={cn(
              "flex-1 truncate",
              selectedClient ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : (value ? value : emptyLabel)}
          </span>
        )}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-md border border-border bg-card shadow-lg"
        >
          {/* Empty option */}
          {allowEmpty && (
            <button
              type="button"
              data-index={0}
              onClick={() => selectClient(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer",
                activeIndex === 0
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              <span className="italic">{emptyLabel}</span>
            </button>
          )}

          {/* Client results */}
          {filtered.length === 0 && query.length > 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Brak wyników dla &quot;{query}&quot;
            </p>
          ) : (
            filtered.map((client, i) => {
              const idx = allowEmpty ? i + 1 : i;
              return (
                <button
                  key={client.id}
                  type="button"
                  data-index={idx}
                  onClick={() => selectClient(client)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors cursor-pointer",
                    idx === activeIndex
                      ? "bg-accent text-foreground"
                      : "text-foreground/80 hover:bg-accent/50"
                  )}
                >
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{client.firstName} {client.lastName}</span>
                    {(client.phone || client.email) && (
                      <span className="text-xs text-muted-foreground truncate block">
                        {client.phone || client.email}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}

          {/* No clients at all */}
          {filtered.length === 0 && query.length === 0 && clients.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Brak klientów w bazie.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
