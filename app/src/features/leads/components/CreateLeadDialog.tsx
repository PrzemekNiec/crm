import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";
import { useCreateLead } from "../api/useLeads";
import { leadFormSchema, type LeadFormValues } from "../types/lead";
import { checkDuplicate, type DuplicateMatch } from "@/features/clients/api/clients";
import { useAuthStore } from "@/store/useAuthStore";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLeadDialog({ open, onOpenChange }: CreateLeadDialogProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const createLead = useCreateLead();
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [checking, setChecking] = useState(false);

  const { register, handleSubmit, reset } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema) as Resolver<LeadFormValues>,
    defaultValues: { fullName: "", estimatedAmount: undefined, phone: "" },
  });

  const onSubmit = async (values: LeadFormValues) => {
    // First submission — check for duplicates (don't block, just warn)
    if (!duplicate && uid && values.phone?.trim()) {
      setChecking(true);
      try {
        const match = await checkDuplicate(uid, values.phone, "");
        if (match) {
          setDuplicate(match);
          setChecking(false);
          return; // Show warning, user can submit again to confirm
        }
      } catch {
        // Duplicate check failed — proceed with creation anyway
      }
      setChecking(false);
    }

    createLead.mutate(values, {
      onSuccess: () => {
        toast.success("Lead dodany");
        setDuplicate(null);
        reset();
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Nie udało się dodać leada.");
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
        <DialogTitle>
          <span className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Nowy potencjalny klient
          </span>
        </DialogTitle>
        <DialogDescription>
          Szybko zapisz kontakt, który jeszcze nie jest w procesie.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Duplicate warning */}
        {duplicate && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-yellow-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-400">
                Uwaga: Ten numer telefonu istnieje już w bazie jako {duplicate.source === "client" ? "Klient" : "Potencjalny"} o imieniu{" "}
                <span className="font-semibold text-foreground">{duplicate.fullName}</span>.
              </p>
              <p className="mt-1 text-muted-foreground">
                Możesz jednak kontynuować zapis.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-fullName">Imię i nazwisko *</Label>
          <Input
            id="lead-fullName"
            placeholder="Jan Kowalski"
            {...register("fullName")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-phone">Telefon</Label>
          <Input
            id="lead-phone"
            type="tel"
            placeholder="+48 600 000 000"
            {...register("phone")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-amount">Szacowana kwota (PLN)</Label>
          <Input
            id="lead-amount"
            type="number"
            placeholder="300 000"
            {...register("estimatedAmount")}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Anuluj
          </Button>
          <Button type="submit" disabled={createLead.isPending || checking}>
            {checking ? "Sprawdzanie…" : createLead.isPending ? "Dodawanie…" : duplicate ? "Dodaj mimo to" : "Dodaj leada"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
