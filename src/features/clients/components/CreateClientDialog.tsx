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
import { useCreateClient } from "../api/useCreateClient";
import {
  clientFormSchema,
  CLIENT_STAGES,
  STAGE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  type ClientFormValues,
} from "../types/client";

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
  const createClient = useCreateClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema) as Resolver<ClientFormValues>,
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      stage: "new_lead",
      priority: "normal",
      mainNote: "",
    },
  });

  const onSubmit = (values: ClientFormValues) => {
    createClient.mutate(values, {
      onSuccess: () => {
        toast.success("Klient został dodany");
        reset();
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
        {/* Full name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Imię i nazwisko *</Label>
          <Input
            id="fullName"
            placeholder="Jan Kowalski"
            {...register("fullName")}
          />
          {errors.fullName && (
            <p className="text-xs text-destructive">
              {errors.fullName.message}
            </p>
          )}
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
          <Button type="submit" disabled={createClient.isPending}>
            {createClient.isPending ? "Zapisywanie…" : "Dodaj klienta"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
