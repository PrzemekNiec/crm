import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useDeals,
  useCreateDeal,
  useUpdateDealStage,
  useToggleCPRegistration,
} from "../api/useDeals";
import { dealsQueryKey } from "../api/deals";
import { useClients } from "@/features/clients/api/useClients";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
  type DealDTO,
  type DealStage,
  type DealFormValues,
  dealFormSchema,
} from "../types/deal";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Plus, GripVertical, User, Clock } from "lucide-react";
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

// ─── Main page ───────────────────────────────────────────────

export function PipelinePage() {
  const { data: deals = [], isLoading } = useDeals();
  const updateStage = useUpdateDealStage();
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [historyDeal, setHistoryDeal] = useState<DealDTO | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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
      if (grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    }
    return grouped;
  }, [deals]);

  const activeDeal = activeDealId
    ? deals.find((d) => d.id === activeDealId) ?? null
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as DealStage;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;

    if (uid) {
      qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
        old?.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
      );
    }

    updateStage.mutate({ dealId, stage: newStage });
  };

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
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6 items-start">
            {DEAL_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage]}
                total={stageTotal(stage)}
                activeDealId={activeDealId}
                onCardClick={setHistoryDeal}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDeal && (
              <DealCardContent
                deal={activeDeal}
                stageColor={DEAL_STAGE_COLORS[activeDeal.stage]}
                isDragging
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} />
      <DealHistoryModal deal={historyDeal} onClose={() => setHistoryDeal(null)} />
    </div>
  );
}

// ─── Stage column (droppable) ────────────────────────────────

function StageColumn({
  stage,
  deals,
  total,
  activeDealId,
  onCardClick,
}: {
  stage: DealStage;
  deals: DealDTO[];
  total: number;
  activeDealId: string | null;
  onCardClick: (deal: DealDTO) => void;
}) {
  const color = DEAL_STAGE_COLORS[stage];
  const { isOver, setNodeRef } = useDroppable({ id: stage });

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
          <span className="font-medium text-primary">{formatCurrency(total)}</span>
        </p>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[60px] space-y-2 rounded-lg p-1 transition-colors",
          isOver && "bg-white/[0.06] ring-1 ring-primary/30"
        )}
      >
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            stageColor={color}
            isHidden={deal.id === activeDealId}
            onClick={() => onCardClick(deal)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Deal card (draggable wrapper) ───────────────────────────

function DealCard({
  deal,
  stageColor,
  isHidden,
  onClick,
}: {
  deal: DealDTO;
  stageColor: string;
  isHidden: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isHidden || isDragging ? 0.3 : 1 }}
      onClick={onClick}
    >
      <DealCardContent
        deal={deal}
        stageColor={stageColor}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─── Deal card content ───────────────────────────────────────

function DealCardContent({
  deal,
  stageColor,
  isDragging,
  dragHandleProps,
}: {
  deal: DealDTO;
  stageColor: string;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const toggleCP = useToggleCPRegistration();
  const isWyplata = deal.stage === "wyplata";
  const isCP = deal.isRegisteredInCP ?? false;

  // Glow for Wypłata stage
  const glowShadow = isWyplata
    ? isCP
      ? "0 0 15px rgba(34, 197, 94, 0.6)"   // green glow
      : "0 0 15px rgba(234, 179, 8, 0.6)"    // gold glow
    : undefined;

  return (
    <div
      className={cn(
        "rounded-lg p-2.5 cursor-pointer transition-shadow",
        isDragging && "shadow-xl ring-1 ring-primary/30"
      )}
      style={{
        ...GLASS_CARD,
        borderLeft: `3px solid ${stageColor}`,
        boxShadow: glowShadow
          ? `${GLASS_CARD.boxShadow}, ${glowShadow}`
          : GLASS_CARD.boxShadow,
      }}
    >
      <div className="flex items-start gap-1.5">
        <div
          {...dragHandleProps}
          className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {deal.title}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-primary">
            {formatCurrency(deal.value)}
          </p>
          {deal.clientName && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{deal.clientName}</span>
            </div>
          )}

          {/* CP checkbox — only in Wypłata stage */}
          {isWyplata && (
            <label
              className="mt-2 flex items-center gap-1.5 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
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
          )}
        </div>
      </div>
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
  if (!deal) return null;

  const stageColor = DEAL_STAGE_COLORS[deal.stage];

  return (
    <Dialog open={!!deal} onOpenChange={(open) => !open && onClose()}>
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
                    {/* Dot */}
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
