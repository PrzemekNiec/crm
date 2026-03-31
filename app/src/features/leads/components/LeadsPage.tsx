import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap, UserPlus, Ban } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";
import { useLeads, useCreateLead, useRejectLead } from "../api/useLeads";
import { useConvertLead } from "../api/useConvertLead";
import type { LeadDTO } from "../api/leads";
import {
  leadFormSchema,
  LEAD_STATUS_LABELS,
  LOSS_REASONS,
  type LeadFormValues,
  type LeadStatus,
} from "../types/lead";

// ─── Currency formatter ─────────────────────────────────────

function formatPLN(amount: number | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Status badge variant ───────────────────────────────────

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "success" | "destructive" {
  switch (status) {
    case "converted":
      return "success";
    case "contacted":
      return "secondary";
    case "lost":
      return "destructive";
    default:
      return "default";
  }
}

function isFreshLead(status: string, createdAt: string | null): boolean {
  if (status !== "new" || !createdAt) return false;
  const created = new Date(createdAt).getTime();
  return Date.now() - created < 24 * 60 * 60 * 1000;
}

// ─── Skeleton ───────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-md bg-card p-4 animate-pulse">
      <div className="h-4 w-36 rounded bg-muted" />
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-5 w-16 rounded-full bg-muted" />
    </div>
  );
}

import { GLASS } from "@/lib/glass";

// ─── Convert Confirmation Dialog ─────────────────────────────

function ConvertDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const convert = useConvertLead();

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Konwertuj leada na klienta</DialogTitle>
        <DialogDescription>
          Czy na pewno chcesz przenieść{" "}
          <span className="font-semibold text-foreground">
            {lead.fullName}
          </span>{" "}
          do głównej bazy klientów? Spowoduje to utworzenie jego profilu.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Anuluj
        </Button>
        <Button
          onClick={() =>
            convert.mutate(lead, {
              onSuccess: () => onOpenChange(false),
            })
          }
          disabled={convert.isPending}
        >
          <UserPlus className="h-4 w-4" />
          {convert.isPending ? "Konwertowanie…" : "Konwertuj"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── Reject Dialog ──────────────────────────────────────────

function RejectDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reject = useRejectLead();
  const [reason, setReason] = useState("");

  if (!lead) return null;

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    reject.mutate(
      { leadId: lead.id, lossReason: trimmed },
      {
        onSuccess: () => {
          toast.success("Lead został oznaczony jako odrzucony.");
          setReason("");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Nie udało się odrzucić leada.");
        },
      }
    );
  };

  const handleChip = (chip: string) => {
    setReason(chip);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm">
      <DialogHeader>
        <DialogTitle>Odrzuć potencjalnego klienta</DialogTitle>
        <DialogDescription>
          Dlaczego odrzucasz{" "}
          <span className="font-semibold text-foreground">
            {lead.fullName}
          </span>
          ?
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        {/* Quick reason chips */}
        <div className="flex flex-wrap gap-2">
          {LOSS_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleChip(r)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                reason === r
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-[var(--surface-8)] bg-[var(--surface-4)] text-muted-foreground hover:bg-[var(--surface-8)] hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Custom reason input */}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lub wpisz własny powód…"
          rows={2}
          className="w-full resize-none rounded-lg bg-[var(--surface-6)] border border-[var(--surface-8)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Anuluj
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!reason.trim() || reject.isPending}
          className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
        >
          <Ban className="h-4 w-4" />
          {reject.isPending ? "Odrzucanie…" : "Potwierdź odrzucenie"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── Page ───────────────────────────────────────────────────

export function LeadsPage() {
  const { data: allLeads, isLoading, isError } = useLeads();
  const leads = allLeads?.filter((l) => l.status !== "converted" && l.status !== "lost");
  const createLead = useCreateLead();
  const [convertLead, setConvertLead] = useState<LeadDTO | null>(null);
  const [rejectLeadTarget, setRejectLeadTarget] = useState<LeadDTO | null>(null);

  const { register, handleSubmit, reset } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema) as Resolver<LeadFormValues>,
    defaultValues: { fullName: "", estimatedAmount: undefined, phone: "" },
  });

  const onSubmit = (values: LeadFormValues) => {
    createLead.mutate(values, {
      onSuccess: () => {
        toast.success("Lead dodany");
        reset();
      },
      onError: () => {
        toast.error("Nie udało się dodać leada.");
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Potencjalni klienci
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Szybkie wpisywanie kontaktów, które jeszcze nie są w procesie.
        </p>
      </div>

      {/* Quick Add Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-end"
        style={GLASS}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Imię i nazwisko *
          </label>
          <Input placeholder="Jan Kowalski" {...register("fullName")} />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-40">
          <label className="text-xs font-medium text-muted-foreground">
            Kwota
          </label>
          <Input
            type="number"
            placeholder="300 000"
            {...register("estimatedAmount")}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-40">
          <label className="text-xs font-medium text-muted-foreground">
            Telefon
          </label>
          <Input
            type="tel"
            placeholder="+48 600 000 000"
            {...register("phone")}
          />
        </div>
        <Button
          type="submit"
          disabled={createLead.isPending}
          className="shrink-0"
        >
          <Zap className="h-4 w-4" />
          {createLead.isPending ? "Dodawanie…" : "Dodaj"}
        </Button>
      </form>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
          <p className="text-sm text-destructive">
            Nie udało się pobrać listy leadów. Spróbuj odświeżyć stronę.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && leads && leads.length === 0 && (
        <div
          className="flex flex-col items-center gap-3 rounded-xl p-12 text-center"
          style={GLASS}
        >
          <Zap className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">
            Brak potencjalnych klientów
          </p>
          <p className="text-sm text-muted-foreground">
            Użyj formularza powyżej, aby szybko dodać nowy kontakt.
          </p>
        </div>
      )}

      {/* Desktop table */}
      {leads && leads.length > 0 && (
        <>
          <div
            className="hidden overflow-x-auto rounded-xl md:block"
            style={GLASS}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-6)] text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Imię i nazwisko</th>
                  <th className="px-4 py-3">Kwota</th>
                  <th className="px-4 py-3">Telefon</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="transition-colors hover:bg-[var(--surface-5)]"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {lead.fullName}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {formatPLN(lead.estimatedAmount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lead.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={statusBadgeVariant(lead.status)}
                        className={isFreshLead(lead.status, lead.createdAt) ? "animate-pulse bg-amber-500/20 text-amber-400 border border-amber-500/40" : ""}
                      >
                        {isFreshLead(lead.status, lead.createdAt)
                          ? "NOWY"
                          : (LEAD_STATUS_LABELS[lead.status as LeadStatus] ?? lead.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lead.status !== "converted" && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConvertLead(lead)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Konwertuj
                          </Button>
                          <button
                            type="button"
                            onClick={() => setRejectLeadTarget(lead)}
                            title="Odrzuć leada"
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 text-red-500 transition-all hover:bg-red-500 hover:text-white cursor-pointer"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-xl p-4"
                style={GLASS}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{lead.fullName}</p>
                  <Badge
                    variant={statusBadgeVariant(lead.status)}
                    className={isFreshLead(lead.status, lead.createdAt) ? "animate-pulse bg-amber-500/20 text-amber-400 border border-amber-500/40" : ""}
                  >
                    {isFreshLead(lead.status, lead.createdAt)
                      ? "NOWY"
                      : (LEAD_STATUS_LABELS[lead.status as LeadStatus] ?? lead.status)}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{formatPLN(lead.estimatedAmount)}</span>
                  {lead.phone && <span>{lead.phone}</span>}
                </div>
                {lead.status !== "converted" && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConvertLead(lead)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Konwertuj
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRejectLeadTarget(lead)}
                      title="Odrzuć leada"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 text-red-500 transition-all hover:bg-red-500 hover:text-white cursor-pointer"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Convert confirmation dialog */}
      <ConvertDialog
        lead={convertLead}
        open={convertLead !== null}
        onOpenChange={(open) => {
          if (!open) setConvertLead(null);
        }}
      />

      {/* Reject dialog */}
      <RejectDialog
        lead={rejectLeadTarget}
        open={rejectLeadTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectLeadTarget(null);
        }}
      />
    </div>
  );
}
