import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap, UserPlus } from "lucide-react";
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
import { useLeads, useCreateLead } from "../api/useLeads";
import { useConvertLead } from "../api/useConvertLead";
import type { LeadDTO } from "../api/leads";
import {
  leadFormSchema,
  LEAD_STATUS_LABELS,
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
): "default" | "secondary" | "success" {
  switch (status) {
    case "converted":
      return "success";
    case "contacted":
      return "secondary";
    default:
      return "default";
  }
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

// ─── Glassmorphism style ─────────────────────────────────────

const GLASS = {
  background: "rgba(30, 41, 59, 0.5)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
} as const;

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

// ─── Page ───────────────────────────────────────────────────

export function LeadsPage() {
  const { data: leads, isLoading, isError } = useLeads();
  const createLead = useCreateLead();
  const [convertLead, setConvertLead] = useState<LeadDTO | null>(null);

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
                <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                    className="transition-colors hover:bg-white/[0.05]"
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
                      <Badge variant={statusBadgeVariant(lead.status)}>
                        {LEAD_STATUS_LABELS[lead.status as LeadStatus] ??
                          lead.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lead.status !== "converted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConvertLead(lead)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Konwertuj
                        </Button>
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
                  <Badge variant={statusBadgeVariant(lead.status)}>
                    {LEAD_STATUS_LABELS[lead.status as LeadStatus] ??
                      lead.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{formatPLN(lead.estimatedAmount)}</span>
                  {lead.phone && <span>{lead.phone}</span>}
                </div>
                {lead.status !== "converted" && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConvertLead(lead)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Konwertuj
                    </Button>
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
    </div>
  );
}
