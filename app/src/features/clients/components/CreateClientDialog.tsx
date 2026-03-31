import { useState } from "react";
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
import { useCreateClient } from "../api/useCreateClient";
import { checkDuplicate, type DuplicateMatch } from "../api/clients";
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

interface CreateClientDialogProps {
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

export function CreateClientDialog({
  open,
  onOpenChange,
}: CreateClientDialogProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const createClient = useCreateClient();
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

  const source = watch("source");

  const onSubmit = async (values: ClientFormValues) => {
    if (!uid) return;
    setDuplicate(null);
    setChecking(true);
    try {
      const dup = await checkDuplicate(uid, values.phone ?? "", values.email ?? "");
      if (dup) {
        setDuplicate(dup);
        setChecking(false);
        return;
      }
    } catch {
      // If check fails, proceed with save
    }
    setChecking(false);

    createClient.mutate(values, {
      onSuccess: () => {
        toast.success("Klient został dodany");
        reset();
        setDuplicate(null);
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Nie udało się dodać klienta. Spróbuj ponownie.");
      },
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setDuplicate(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogHeader>
        <DialogTitle>Nowy klient</DialogTitle>
        <DialogDescription>
          Uzupełnij podstawowe dane klienta. Pozostałe pola możesz dodać
          później.
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
            <Label htmlFor="referralName">Nazwa pośrednika</Label>
            <Input
              id="referralName"
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
            <Label htmlFor="referralRate">Stawka %</Label>
            <Input
              id="referralRate"
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
            <Label htmlFor="firstName">Imię *</Label>
            <Input
              id="firstName"
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
            <Label htmlFor="lastName">Nazwisko *</Label>
            <Input
              id="lastName"
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
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+48 600 000 000"
            {...register("phone")}
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
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
            <Label htmlFor="stage">Etap sprawy</Label>
            <Select
              id="stage"
              options={stageOptions}
              {...register("stage")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Priorytet</Label>
            <Select
              id="priority"
              options={priorityOptions}
              {...register("priority")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
          >
            Anuluj
          </Button>
          <Button type="submit" disabled={createClient.isPending || checking}>
            {checking ? "Sprawdzanie…" : createClient.isPending ? "Zapisywanie…" : "Dodaj klienta"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
