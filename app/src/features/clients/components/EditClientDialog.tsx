import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { AlertTriangle } from "lucide-react";
import { useUpdateClient } from "../api/useUpdateClient";
import { checkDuplicate, type DuplicateMatch } from "../api/clients";
import type { ClientDTO } from "../api/clients";
import { useAuthStore } from "@/store/useAuthStore";
import {
  clientFormSchema,
  CLIENT_STAGES,
  STAGE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  CLIENT_SOURCES,
  CLIENT_SOURCE_LABELS,
  type ClientFormValues,
} from "../types/client";
import { cn } from "@/lib/cn";

interface EditClientDialogProps {
  client: ClientDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stageOptions = CLIENT_STAGES.map((s) => ({
  value: s,
  label: STAGE_LABELS[s],
}));

const priorityOptions = PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABELS[p],
}));

export function EditClientDialog({
  client,
  open,
  onOpenChange,
}: EditClientDialogProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const update = useUpdateClient(client?.id);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [checking, setChecking] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema) as Resolver<ClientFormValues>,
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      stage: "new_lead",
      priority: "normal",
      mainNote: "",
      source: "organic",
      referralName: "",
      leadSource: "",
      bankPrimary: "",
      tags: [],
    },
  });

  // Populate form when client changes
  useEffect(() => {
    if (client && open) {
      reset({
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        stage: client.stage as ClientFormValues["stage"],
        priority: client.priority as ClientFormValues["priority"],
        mainNote: client.mainNote,
        source: (client.source ?? "organic") as ClientFormValues["source"],
        referralName: client.referralName ?? "",
        referralRate: client.referralRate,
        leadSource: client.leadSource,
        bankPrimary: client.bankPrimary,
        tags: client.tags ?? [],
        preferredContactChannel:
          client.preferredContactChannel as ClientFormValues["preferredContactChannel"],
        productType: client.productType as ClientFormValues["productType"],
        loanAmount: client.loanAmount,
        propertyValue: client.propertyValue,
        downPayment: client.downPayment,
      });
    }
  }, [client, open, reset]);

  const source = watch("source");

  const onSubmit = async (values: ClientFormValues) => {
    if (!uid || !client) return;
    setDuplicate(null);
    setChecking(true);
    try {
      const dup = await checkDuplicate(uid, values.phone ?? "", values.email ?? "", client.id);
      if (dup) {
        setDuplicate(dup);
        setChecking(false);
        return;
      }
    } catch {
      // If check fails, proceed with save
    }
    setChecking(false);

    update.mutate(values, {
      onSuccess: () => {
        toast.success("Dane klienta zostały zaktualizowane");
        setDuplicate(null);
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Nie udało się zapisać zmian. Spróbuj ponownie.");
      },
    });
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Edytuj klienta</DialogTitle>
        <DialogDescription>
          Zmień dane klienta{" "}
          <span className="font-semibold text-foreground">
            {client.firstName} {client.lastName}
          </span>
          .
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Duplicate alert */}
        {duplicate && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-400">
                Klient o tym {duplicate.field === "phone" ? "numerze telefonu" : "adresie e-mail"} już istnieje w bazie.
              </p>
              <p className="mt-1 text-muted-foreground">
                Istniejący klient: <span className="font-semibold text-foreground">{duplicate.firstName} {duplicate.lastName}</span>
              </p>
            </div>
          </div>
        )}

        {/* Source */}
        <div className="flex flex-col gap-2">
          <Label>Źródło klienta</Label>
          <div className="flex gap-2">
            {CLIENT_SOURCES.map((s) => (
              <label
                key={s}
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                  source === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                )}
              >
                <input
                  type="radio"
                  value={s}
                  {...register("source")}
                  className="sr-only"
                />
                {CLIENT_SOURCE_LABELS[s]}
              </label>
            ))}
          </div>
        </div>

        {/* Referral details (conditional) */}
        <div
          className={cn(
            "grid grid-cols-1 gap-4 overflow-hidden transition-all duration-300 sm:grid-cols-[1fr_8rem]",
            source === "referral"
              ? "max-h-40 opacity-100"
              : "max-h-0 opacity-0"
          )}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-referralName">Nazwa pośrednika</Label>
            <Input
              id="edit-referralName"
              placeholder="Biuro X"
              {...register("referralName")}
            />
            {errors.referralName && (
              <p className="text-xs text-destructive">
                {errors.referralName.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-referralRate">Stawka %</Label>
            <Input
              id="edit-referralRate"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="10"
              {...register("referralRate")}
            />
            {errors.referralRate && (
              <p className="text-xs text-destructive">
                {errors.referralRate.message}
              </p>
            )}
          </div>
        </div>

        {/* First name + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-firstName">Imię *</Label>
            <Input
              id="edit-firstName"
              placeholder="Jan"
              {...register("firstName")}
            />
            {errors.firstName && (
              <p className="text-xs text-destructive">
                {errors.firstName.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-lastName">Nazwisko *</Label>
            <Input
              id="edit-lastName"
              placeholder="Kowalski"
              {...register("lastName")}
            />
            {errors.lastName && (
              <p className="text-xs text-destructive">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-phone">Telefon</Label>
          <Input
            id="edit-phone"
            type="tel"
            placeholder="+48 600 000 000"
            {...register("phone")}
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-email">E-mail</Label>
          <Input
            id="edit-email"
            type="email"
            placeholder="jan@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Stage + Priority row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-stage">Etap sprawy</Label>
            <Select
              id="edit-stage"
              options={stageOptions}
              {...register("stage")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-priority">Priorytet</Label>
            <Select
              id="edit-priority"
              options={priorityOptions}
              {...register("priority")}
            />
          </div>
        </div>

        {/* Main note */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-mainNote">Notatka główna</Label>
          <textarea
            id="edit-mainNote"
            {...register("mainNote")}
            rows={3}
            className="w-full resize-none rounded-lg bg-[var(--surface-6)] border border-[var(--surface-8)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Dodatkowe informacje o kliencie…"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anuluj
          </Button>
          <Button type="submit" disabled={update.isPending || checking}>
            {checking ? "Sprawdzanie…" : update.isPending ? "Zapisywanie…" : "Zapisz zmiany"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
