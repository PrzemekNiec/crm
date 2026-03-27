import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap } from "lucide-react";
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

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLeadDialog({ open, onOpenChange }: CreateLeadDialogProps) {
  const createLead = useCreateLead();

  const { register, handleSubmit, reset } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema) as Resolver<LeadFormValues>,
    defaultValues: { fullName: "", estimatedAmount: undefined, phone: "" },
  });

  const onSubmit = (values: LeadFormValues) => {
    createLead.mutate(values, {
      onSuccess: () => {
        toast.success("Lead dodany");
        reset();
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Nie udało się dodać leada.");
      },
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
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
          <Button type="submit" disabled={createLead.isPending}>
            {createLead.isPending ? "Dodawanie…" : "Dodaj leada"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
