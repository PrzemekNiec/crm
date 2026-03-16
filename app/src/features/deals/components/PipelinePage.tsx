import { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useDeals,
  useCreateDeal,
  useUpdateDealStage,
  useUpdateDealTitle,
  useUpdateDealNotes,
  useToggleCPRegistration,
  useUpdateDealCommission,
  useArchiveDeal,
  useRejectDeal,
} from "../api/useDeals";
import { dealsQueryKey } from "../api/deals";
import { useClients } from "@/features/clients/api/useClients";
import { CLIENT_SOURCE_LABELS, type ClientSource } from "@/features/clients/types/client";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
  type DealDTO,
  type DealStage,
  type DealFormValues,
  type SettleDealValues,
  dealFormSchema,
  settleDealSchema,
} from "../types/deal";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import {
  Plus,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  Archive,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const GLASS = {
  background: "rgba(30, 41, 59, 0.5)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
} as const;

const GLASS_CARD = {
  background: "rgba(30, 41, 59, 0.7)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 4px 16px 0 rgba(0, 0, 0, 0.25)",
} as const;

// ─── Helpers ─────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAdjacentStages(stage: DealStage): {
  prev: DealStage | null;
  next: DealStage | null;
} {
  const idx = DEAL_STAGES.indexOf(stage);
  return {
    prev: idx > 0 ? DEAL_STAGES[idx - 1] : null,
    next: idx < DEAL_STAGES.length - 1 ? DEAL_STAGES[idx + 1] : null,
  };
}

// ─── Main page ───────────────────────────────────────────────

export function PipelinePage() {
  const { data: deals = [], isLoading } = useDeals();
  const [addOpen, setAddOpen] = useState(false);
  const [historyDeal, setHistoryDeal] = useState<DealDTO | null>(null);
  const [settleDeal, setSettleDeal] = useState<DealDTO | null>(null);

  const dealsByStage = useMemo(() => {
    const grouped: Record<DealStage, DealDTO[]> = {
      potencjalne: [],
      fi: [],
      analiza: [],
      decyzja: [],
      umowa: [],
      wyplata: [],
    };
    for (const deal of deals) {
      if (!deal.isArchived && grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    }
    return grouped;
  }, [deals]);

  const stageTotal = (stage: DealStage) =>
    dealsByStage[stage].reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Lejek sprzedaży</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Dodaj szansę
        </Button>
      </div>

      {/* Kanban board — 6 columns */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {DEAL_STAGES.map((s) => (
            <div key={s} className="rounded-xl p-3 animate-pulse" style={GLASS}>
              <div className="h-5 w-20 rounded bg-muted mb-3" />
              <div className="space-y-2">
                <div className="h-16 rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6 items-start">
          {DEAL_STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              deals={dealsByStage[stage]}
              total={stageTotal(stage)}
              onCardClick={setHistoryDeal}
              onArchive={setSettleDeal}
            />
          ))}
        </div>
      )}

      {/* Archived deals table */}
      {!isLoading && <ArchivedDealsTable deals={deals} />}

      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} />
      <DealHistoryModal deal={historyDeal} onClose={() => setHistoryDeal(null)} />
      <SettleDealModal deal={settleDeal} onClose={() => setSettleDeal(null)} />
    </div>
  );
}

// ─── Stage column ────────────────────────────────────────────

function StageColumn({
  stage,
  deals,
  total,
  onCardClick,
  onArchive,
}: {
  stage: DealStage;
  deals: DealDTO[];
  total: number;
  onCardClick: (deal: DealDTO) => void;
  onArchive: (deal: DealDTO) => void;
}) {
  const color = DEAL_STAGE_COLORS[stage];

  return (
    <div className="rounded-xl p-3" style={GLASS}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h3 className="text-xs font-semibold text-foreground">
            {DEAL_STAGE_LABELS[stage]}
          </h3>
        </div>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {deals.length}
        </Badge>
      </div>

      {total > 0 && (
        <p className="mb-2 text-[10px] text-muted-foreground">
          <span className="font-medium text-primary">
            {formatCurrency(total)}
          </span>
        </p>
      )}

      <div className="min-h-[60px] space-y-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            stageColor={color}
            onClick={() => onCardClick(deal)}
            onArchive={() => onArchive(deal)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Month labels ───────────────────────────────────────────

const MONTH_LABELS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

// ─── Archived Deals Table ───────────────────────────────────

function ArchivedDealsTable({ deals }: { deals: DealDTO[] }) {
  const { data: clients = [] } = useClients();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const archived = useMemo(
    () => deals.filter((d) => d.isArchived),
    [deals]
  );

  // Build year options from data
  const years = useMemo(() => {
    const set = new Set<number>();
    set.add(currentYear);
    for (const d of archived) {
      if (d.payoutDate) {
        const y = parseInt(d.payoutDate.split("-")[0], 10);
        if (!isNaN(y)) set.add(y);
      }
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [archived, currentYear]);

  // Client source lookup
  const clientSourceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      const src = c.source as ClientSource | undefined;
      map.set(c.id, src ? (CLIENT_SOURCE_LABELS[src] ?? "—") : "—");
    }
    return map;
  }, [clients]);

  // Group by month for selected year
  const grouped = useMemo(() => {
    const months: Record<number, DealDTO[]> = {};
    for (const d of archived) {
      if (!d.payoutDate) continue;
      const [y, m] = d.payoutDate.split("-").map(Number);
      if (y !== selectedYear) continue;
      if (!months[m]) months[m] = [];
      months[m].push(d);
    }
    return months;
  }, [archived, selectedYear]);

  const sortedMonths = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  const totalCommission = sortedMonths.reduce(
    (sum, m) =>
      sum + grouped[m].reduce((s, d) => s + (d.commissionValue ?? 0), 0),
    0
  );

  if (archived.length === 0) return null;

  return (
    <>
      {/* Divider */}
      <div
        className="mt-4 rounded-xl px-5 py-3 flex items-center justify-between"
        style={GLASS}
      >
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Archive className="h-5 w-5 text-primary" />
          Archiwum wypłat
          {totalCommission > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              Suma: <span className="text-primary font-semibold">{formatCurrency(totalCommission)}</span>
            </span>
          )}
        </h2>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {sortedMonths.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Brak zarchiwizowanych spraw w {selectedYear} roku.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedMonths.map((month) => {
            const monthDeals = grouped[month];
            const monthTotal = monthDeals.reduce(
              (s, d) => s + (d.commissionValue ?? 0),
              0
            );
            return (
              <div key={month} className="rounded-xl overflow-hidden" style={GLASS}>
                {/* Month header */}
                <div
                  className="px-4 py-2 flex items-center justify-between"
                  style={{
                    background: "rgba(201, 149, 107, 0.1)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <h3 className="text-sm font-semibold text-foreground">
                    {MONTH_LABELS[month - 1]}
                  </h3>
                  <span className="text-sm font-semibold text-primary">
                    {formatCurrency(monthTotal)}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider">
                        <th className="px-4 py-2 font-medium">Klient</th>
                        <th className="px-4 py-2 font-medium">Bank</th>
                        <th className="px-4 py-2 font-medium text-right">Kwota</th>
                        <th className="px-4 py-2 font-medium text-right">Stawka %</th>
                        <th className="px-4 py-2 font-medium text-right">Prowizja</th>
                        <th className="px-4 py-2 font-medium">Źródło</th>
                        <th className="px-4 py-2 font-medium">Notatki</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthDeals.map((d) => (
                        <ArchiveRow
                          key={d.id}
                          deal={d}
                          clientSource={clientSourceMap.get(d.clientId) ?? "—"}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Archive Row (inline commission editing) ────────────────

function ArchiveRow({
  deal,
  clientSource,
}: {
  deal: DealDTO;
  clientSource: string;
}) {
  const updateCommission = useUpdateDealCommission();
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState(deal.commissionRate ?? 0);
  const [val, setVal] = useState(deal.commissionValue ?? 0);
  const rateRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setRate(deal.commissionRate ?? 0);
    setVal(deal.commissionValue ?? 0);
    setEditing(true);
    setTimeout(() => rateRef.current?.focus(), 0);
  };

  const save = () => {
    if (rate !== deal.commissionRate || val !== deal.commissionValue) {
      if (uid) {
        qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
          old?.map((d) =>
            d.id === deal.id
              ? { ...d, commissionRate: rate, commissionValue: val }
              : d
          )
        );
      }
      updateCommission.mutate({ dealId: deal.id, rate, value: val });
    }
    setEditing(false);
  };

  // Auto-calc commission when rate changes during edit
  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    setVal(Math.round(deal.value * newRate / 100));
  };

  return (
    <tr className="border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors">
      <td className="px-4 py-2.5 text-foreground font-medium">
        <span>{deal.clientName ?? "—"}</span>
        {deal.isRejected && (
          <Badge variant="destructive" className="ml-1.5 text-[9px] px-1.5 py-0">
            Odrzucony
          </Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-foreground">
        {deal.bank ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-foreground text-right">
        {formatCurrency(deal.value)}
      </td>
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <input
            ref={rateRef}
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={save}
            className="w-20 rounded bg-white/10 border border-white/20 px-1.5 py-0.5 text-xs text-foreground text-right outline-none focus:ring-1 focus:ring-primary/50"
          />
        ) : (
          <span
            className="text-foreground cursor-pointer group inline-flex items-center gap-1 hover:text-primary transition-colors"
            onClick={startEdit}
          >
            {deal.commissionRate != null ? `${deal.commissionRate}%` : "—"}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={save}
            className="w-24 rounded bg-white/10 border border-white/20 px-1.5 py-0.5 text-xs text-foreground text-right outline-none focus:ring-1 focus:ring-primary/50"
          />
        ) : (
          <span
            className="text-primary font-semibold cursor-pointer hover:text-primary/80 transition-colors"
            onClick={startEdit}
          >
            {deal.commissionValue != null ? formatCurrency(deal.commissionValue) : "—"}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-xs">
        {clientSource}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">
        {deal.isRejected && deal.rejectionReason
          ? <span className="text-red-400">{deal.rejectionReason}</span>
          : (deal.notes || "—")}
      </td>
    </tr>
  );
}

// ─── Deal card ───────────────────────────────────────────────

function DealCard({
  deal,
  stageColor,
  onClick,
  onArchive,
}: {
  deal: DealDTO;
  stageColor: string;
  onClick: () => void;
  onArchive: () => void;
}) {
  const updateStage = useUpdateDealStage();
  const updateTitle = useUpdateDealTitle();
  const toggleCP = useToggleCPRegistration();
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(deal.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const { prev, next } = getAdjacentStages(deal.stage);
  const isWyplata = deal.stage === "wyplata";
  const isCP = deal.isRegisteredInCP ?? false;

  const startEditing = () => {
    setEditValue(deal.title);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveTitle = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== deal.title) {
      if (uid) {
        qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
          old?.map((d) => (d.id === deal.id ? { ...d, title: trimmed } : d))
        );
      }
      updateTitle.mutate({ dealId: deal.id, title: trimmed });
    }
    setIsEditing(false);
  };

  const moveTo = (newStage: DealStage) => {
    // Optimistic update
    if (uid) {
      qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
        old?.map((d) =>
          d.id === deal.id ? { ...d, stage: newStage } : d
        )
      );
    }
    updateStage.mutate({ dealId: deal.id, stage: newStage });
  };

  // Glow for Wypłata stage
  const glowShadow = isWyplata
    ? isCP
      ? "0 0 15px rgba(34, 197, 94, 0.6)"
      : "0 0 15px rgba(234, 179, 8, 0.6)"
    : undefined;

  const hasNotes = !!(deal.notes && deal.notes.trim());

  return (
    <div
      className={cn(
        "rounded-lg p-2.5 cursor-pointer transition-shadow",
        hasNotes && "animate-pulse-border"
      )}
      style={{
        ...GLASS_CARD,
        borderLeft: `3px solid ${stageColor}`,
        boxShadow: glowShadow
          ? `${GLASS_CARD.boxShadow}, ${glowShadow}`
          : GLASS_CARD.boxShadow,
        ...(hasNotes
          ? { border: "1px solid rgba(239, 68, 68, 0.7)" }
          : {}),
      }}
      onClick={onClick}
    >
      {/* Content */}
      <div className="min-w-0">
        {isEditing ? (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setIsEditing(false);
              }}
              onBlur={saveTitle}
              className="w-full rounded bg-white/10 border border-white/20 px-1.5 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={saveTitle}
              className="shrink-0 text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <p className="text-xs font-medium text-foreground truncate">
              {deal.title}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
              className="shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground cursor-pointer transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="mt-0.5 text-sm font-semibold text-primary">
          {formatCurrency(deal.value)}
        </p>
        {deal.clientName && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">{deal.clientName}</span>
          </div>
        )}
      </div>

      {/* Stage arrows */}
      <div
        className="mt-2 flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && moveTo(prev)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border transition-colors cursor-pointer",
            prev
              ? "border-white/20 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              : "border-transparent text-transparent cursor-default"
          )}
          title={prev ? `← ${DEAL_STAGE_LABELS[prev]}` : undefined}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <span className="text-[9px] text-muted-foreground/60 font-medium">
          {DEAL_STAGE_LABELS[deal.stage]}
        </span>

        <button
          type="button"
          disabled={!next}
          onClick={() => next && moveTo(next)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border transition-colors cursor-pointer",
            next
              ? "border-white/20 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              : "border-transparent text-transparent cursor-default"
          )}
          title={next ? `→ ${DEAL_STAGE_LABELS[next]}` : undefined}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* CP checkbox + Archive — only in Wypłata */}
      {isWyplata && (
        <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isCP}
              onChange={(e) => {
                e.stopPropagation();
                toggleCP.mutate({ dealId: deal.id, value: !isCP });
              }}
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 accent-emerald-500"
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                isCP ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {isCP ? "Zarejestrowano w CP" : "Rejestracja CP"}
            </span>
          </label>
          <button
            type="button"
            onClick={onArchive}
            className="flex items-center gap-1 text-[10px] font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <Archive className="h-3 w-3" />
            Zarchiwizuj
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Deal History Modal ──────────────────────────────────────

function DealHistoryModal({
  deal,
  onClose,
}: {
  deal: DealDTO | null;
  onClose: () => void;
}) {
  const updateNotes = useUpdateDealNotes();
  const reject = useRejectDeal();
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();
  const [notesValue, setNotesValue] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Sync local state when deal changes
  useEffect(() => {
    if (deal) {
      setNotesValue(deal.notes ?? "");
      setNotesDirty(false);
    }
  }, [deal?.id]);

  if (!deal) return null;

  const stageColor = DEAL_STAGE_COLORS[deal.stage];

  const saveNotes = () => {
    if (!notesDirty) return;
    if (uid) {
      qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
        old?.map((d) => (d.id === deal.id ? { ...d, notes: notesValue } : d))
      );
    }
    updateNotes.mutate({ dealId: deal.id, notes: notesValue });
    setNotesDirty(false);
  };

  return (
    <Dialog open={!!deal} onOpenChange={(open) => {
      if (!open) {
        saveNotes();
        onClose();
      }
    }}>
      <div className="space-y-4">
        {/* Header */}
        <div className="pr-6">
          <h2 className="text-lg font-semibold text-foreground">
            {deal.title}
          </h2>
          {deal.clientName && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {deal.clientName}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <p className="text-xl font-bold text-primary">
            {formatCurrency(deal.value)}
          </p>
          <Badge
            variant="secondary"
            style={{ borderColor: stageColor, color: stageColor }}
          >
            {DEAL_STAGE_LABELS[deal.stage]}
          </Badge>
          {deal.isRegisteredInCP && (
            <Badge variant="success" className="text-[10px]">
              CP
            </Badge>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="deal-notes" className="text-sm font-semibold text-foreground mb-1.5 block">
            Notatki
          </Label>
          <textarea
            id="deal-notes"
            value={notesValue}
            onChange={(e) => {
              setNotesValue(e.target.value);
              setNotesDirty(true);
            }}
            onBlur={saveNotes}
            placeholder="Dodaj notatki do tej szansy..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        {/* Timeline */}
        <div>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            Historia etapów
          </h3>

          {deal.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak historii zmian etapów.
            </p>
          ) : (
            <div className="relative ml-2 border-l border-white/[0.1] pl-4 space-y-4">
              {deal.history.map((entry, i) => {
                const color = DEAL_STAGE_COLORS[entry.stage] ?? "#94a3b8";
                const isLast = i === deal.history.length - 1;
                return (
                  <div key={i} className="relative">
                    <div
                      className={cn(
                        "absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background",
                        isLast ? "ring-2 ring-primary/40" : ""
                      )}
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-sm font-medium text-foreground">
                      {DEAL_STAGE_LABELS[entry.stage] ?? entry.stage}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(entry.timestamp)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rejection section — only for analiza & decyzja */}
        {(deal.stage === "analiza" || deal.stage === "decyzja") && (
          <div
            className="rounded-lg p-3 space-y-2"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            {!rejectOpen ? (
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <XCircle className="h-4 w-4" />
                Decyzja negatywna
              </button>
            ) : (
              <>
                <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />
                  Decyzja negatywna
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Powód odrzucenia (opcjonalnie)..."
                  rows={2}
                  className="w-full rounded-md border border-red-500/30 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-red-500/50 resize-y"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRejectOpen(false);
                      setRejectReason("");
                    }}
                  >
                    Anuluj
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={reject.isPending}
                    onClick={() => {
                      reject.mutate(
                        { dealId: deal.id, reason: rejectReason },
                        {
                          onSuccess: () => {
                            setRejectOpen(false);
                            setRejectReason("");
                            onClose();
                          },
                        }
                      );
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {reject.isPending ? "Odrzucanie..." : "Potwierdź odrzucenie"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ─── Settle Deal Modal ──────────────────────────────────────

function SettleDealModal({
  deal,
  onClose,
}: {
  deal: DealDTO | null;
  onClose: () => void;
}) {
  const archive = useArchiveDeal();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettleDealValues>({
    resolver: zodResolver(settleDealSchema),
    defaultValues: {
      bank: "",
      commissionRate: 0,
      commissionValue: 0,
      payoutDate: currentMonth,
      notes: deal?.notes ?? "",
    },
  });

  // Reset form when deal changes
  useEffect(() => {
    if (deal) {
      reset({
        bank: deal.bank ?? "",
        commissionRate: deal.commissionRate ?? 0,
        commissionValue: deal.commissionValue ?? 0,
        payoutDate: deal.payoutDate ?? currentMonth,
        notes: deal.notes ?? "",
      });
    }
  }, [deal?.id]);

  const rate = watch("commissionRate");

  // Auto-calculate commission from rate * deal value
  useEffect(() => {
    if (deal && rate > 0) {
      setValue("commissionValue", Math.round(deal.value * rate / 100));
    }
  }, [rate, deal?.value]);

  if (!deal) return null;

  const onSubmit = (values: SettleDealValues) => {
    archive.mutate(
      { dealId: deal.id, values },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={!!deal} onOpenChange={(open) => !open && onClose()}>
      <div className="space-y-4">
        <div className="pr-6">
          <h2 className="text-lg font-semibold text-foreground">
            Rozliczenie: {deal.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {deal.clientName} &middot; {formatCurrency(deal.value)}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settle-bank">Bank *</Label>
            <Input
              id="settle-bank"
              placeholder="np. PKO BP, ING, mBank..."
              {...register("bank")}
            />
            {errors.bank && (
              <p className="text-xs text-destructive">{errors.bank.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="settle-rate">Stawka %</Label>
              <Input
                id="settle-rate"
                type="number"
                step="0.01"
                placeholder="np. 1.5"
                {...register("commissionRate", { valueAsNumber: true })}
              />
              {errors.commissionRate && (
                <p className="text-xs text-destructive">
                  {errors.commissionRate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settle-value">Prowizja PLN</Label>
              <Input
                id="settle-value"
                type="number"
                placeholder="np. 7500"
                {...register("commissionValue", { valueAsNumber: true })}
              />
              {errors.commissionValue && (
                <p className="text-xs text-destructive">
                  {errors.commissionValue.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settle-payout">Miesiąc wypłaty</Label>
            <Input
              id="settle-payout"
              type="month"
              {...register("payoutDate")}
            />
            {errors.payoutDate && (
              <p className="text-xs text-destructive">
                {errors.payoutDate.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settle-notes">Notatki</Label>
            <textarea
              id="settle-notes"
              {...register("notes")}
              placeholder="Dodatkowe informacje..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={archive.isPending}>
              {archive.isPending ? "Archiwizowanie..." : "Zarchiwizuj"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

// ─── Add deal dialog ─────────────────────────────────────────

function AddDealDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: clients = [] } = useClients();
  const createDeal = useCreateDeal();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      clientId: "",
      title: "",
      value: 0,
      stage: "potencjalne" as const,
    },
  });

  const onSubmit = (values: DealFormValues) => {
    const client = clients.find((c) => c.id === values.clientId);
    createDeal.mutate(
      { ...values, clientName: client?.fullName },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Nowa szansa sprzedażowa
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal-client">Klient *</Label>
            <select
              id="deal-client"
              {...register("clientId")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Wybierz klienta...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
            {errors.clientId && (
              <p className="text-xs text-destructive">
                {errors.clientId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal-title">Tytuł *</Label>
            <Input
              id="deal-title"
              placeholder="np. Hipoteka PKO BP"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal-value">Kwota (PLN)</Label>
            <Input
              id="deal-value"
              type="number"
              placeholder="np. 500000"
              {...register("value", { valueAsNumber: true })}
            />
            {errors.value && (
              <p className="text-xs text-destructive">
                {errors.value.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending ? "Dodawanie..." : "Dodaj"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
