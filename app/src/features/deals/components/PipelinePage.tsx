import { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { useDeals, useCreateDeal, useUpdateDealStage } from "../api/useDeals";
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
import { Plus, GripVertical, User } from "lucide-react";
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

// ─── Formatowanie kwoty ──────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Main page ───────────────────────────────────────────────

export function PipelinePage() {
  const { data: deals = [], isLoading } = useDeals();
  const updateStage = useUpdateDealStage();
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  // Group deals by stage
  const dealsByStage: Record<DealStage, DealDTO[]> = {
    contact: [],
    analysis: [],
    decision: [],
    success: [],
  };
  for (const deal of deals) {
    if (dealsByStage[deal.stage]) {
      dealsByStage[deal.stage].push(deal);
    }
  }

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      )
        return;

      const newStage = destination.droppableId as DealStage;

      // Optimistic update
      if (uid) {
        qc.setQueryData<DealDTO[]>(dealsQueryKey(uid), (old) =>
          old?.map((d) => (d.id === draggableId ? { ...d, stage: newStage } : d))
        );
      }

      updateStage.mutate({ dealId: draggableId, stage: newStage });
    },
    [uid, qc, updateStage]
  );

  // Stage totals
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

      {/* Kanban board */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {DEAL_STAGES.map((s) => (
            <div key={s} className="rounded-xl p-4 animate-pulse" style={GLASS}>
              <div className="h-6 w-32 rounded bg-muted mb-4" />
              <div className="space-y-3">
                <div className="h-20 rounded-lg bg-muted" />
                <div className="h-20 rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 items-start">
            {DEAL_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage]}
                total={stageTotal(stage)}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Add deal dialog */}
      <AddDealDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

// ─── Stage column ────────────────────────────────────────────

function StageColumn({
  stage,
  deals,
  total,
}: {
  stage: DealStage;
  deals: DealDTO[];
  total: number;
}) {
  const color = DEAL_STAGE_COLORS[stage];

  return (
    <div className="rounded-xl p-3" style={GLASS}>
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h3 className="text-sm font-semibold text-foreground">
            {DEAL_STAGE_LABELS[stage]}
          </h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {deals.length}
        </Badge>
      </div>

      {/* Total */}
      {total > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          Suma: <span className="font-medium text-primary">{formatCurrency(total)}</span>
        </p>
      )}

      {/* Droppable area */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "min-h-[80px] space-y-2 rounded-lg p-1 transition-colors",
              snapshot.isDraggingOver && "bg-white/[0.04]"
            )}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} stageColor={color} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─── Deal card ───────────────────────────────────────────────

function DealCard({
  deal,
  index,
  stageColor,
}: {
  deal: DealDTO;
  index: number;
  stageColor: string;
}) {
  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "rounded-lg p-3 transition-shadow cursor-grab active:cursor-grabbing",
            snapshot.isDragging && "shadow-xl ring-1 ring-primary/30"
          )}
          style={{
            ...GLASS_CARD,
            borderLeft: `3px solid ${stageColor}`,
            ...provided.draggableProps.style,
          }}
        >
          <div className="flex items-start gap-2">
            <div
              {...provided.dragHandleProps}
              className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {deal.title}
              </p>
              <p className="mt-1 text-base font-semibold text-primary">
                {formatCurrency(deal.value)}
              </p>
              {deal.clientName && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{deal.clientName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
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
    defaultValues: { clientId: "", title: "", value: 0, stage: "contact" as const },
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
          {/* Client select */}
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
              <p className="text-xs text-destructive">{errors.clientId.message}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">Tytuł *</Label>
            <Input
              id="deal-title"
              placeholder="np. Hipoteka PKO BP"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-value">Kwota (PLN)</Label>
            <Input
              id="deal-value"
              type="number"
              placeholder="np. 500000"
              {...register("value", { valueAsNumber: true })}
            />
            {errors.value && (
              <p className="text-xs text-destructive">{errors.value.message}</p>
            )}
          </div>

          {/* Actions */}
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
