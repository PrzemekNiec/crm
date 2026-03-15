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
import { useClients } from "@/features/clients/api/useClients";
import { useCreateTask } from "../api/useCreateTask";
import {
  taskFormSchema,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  TASK_PRIORITIES,
  type TaskFormValues,
} from "../types/task";
import { PRIORITY_LABELS } from "@/features/clients/types/client";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeOptions = TASK_TYPES.map((t) => ({
  value: t,
  label: TASK_TYPE_LABELS[t],
}));

const priorityOptions = TASK_PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABELS[p],
}));

export function CreateTaskDialog({
  open,
  onOpenChange,
}: CreateTaskDialogProps) {
  const { data: clients } = useClients();
  const createTask = useCreateTask();

  const clientOptions = (clients ?? []).map((c) => ({
    value: c.id,
    label: c.fullName,
  }));

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema) as Resolver<TaskFormValues>,
    defaultValues: {
      clientId: "",
      clientName: "",
      type: "call",
      title: "",
      description: "",
      dueDate: "",
      durationMin: 30,
      priority: "normal",
      syncToGoogleCalendar: true,
    },
  });

  const syncEnabled = watch("syncToGoogleCalendar");

  const onClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const client = clients?.find((c) => c.id === selectedId);
    setValue("clientId", selectedId);
    setValue("clientName", client?.fullName ?? "");
  };

  const onSubmit = (values: TaskFormValues) => {
    createTask.mutate(values, {
      onSuccess: () => {
        toast.success("Zadanie zostało dodane");
        reset();
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Nie udało się dodać zadania. Spróbuj ponownie.");
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
        <DialogTitle>Nowe zadanie</DialogTitle>
        <DialogDescription>
          Przypisz zadanie do klienta i ustaw termin.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Client select */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientId">Klient *</Label>
          <Select
            id="clientId"
            options={clientOptions}
            placeholder="Wybierz klienta"
            value={watch("clientId")}
            onChange={onClientChange}
          />
          <input type="hidden" {...register("clientName")} />
          {errors.clientId && (
            <p className="text-xs text-destructive">
              {errors.clientId.message}
            </p>
          )}
        </div>

        {/* Type + Title */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Typ zadania</Label>
            <Select id="type" options={typeOptions} {...register("type")} />
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Tytuł *</Label>
          <Input
            id="title"
            placeholder="Na przykład: Oddzwonić w sprawie dokumentów"
            {...register("title")}
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Due date + Duration */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueDate">Termin</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              {...register("dueDate")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="durationMin">Czas trwania (minuty)</Label>
            <Input
              id="durationMin"
              type="number"
              min={5}
              max={480}
              {...register("durationMin")}
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Opis</Label>
          <textarea
            id="description"
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Opcjonalny opis zadania"
            {...register("description")}
          />
        </div>

        {/* Sync toggle */}
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            {...register("syncToGoogleCalendar")}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              Synchronizuj z Google Calendar
            </p>
            <p className="text-xs text-muted-foreground">
              {syncEnabled
                ? "Wydarzenie pojawi się w kalendarzu po zapisie"
                : "Zadanie nie będzie synchronizowane"}
            </p>
          </div>
        </label>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
          >
            Anuluj
          </Button>
          <Button type="submit" disabled={createTask.isPending}>
            {createTask.isPending ? "Zapisywanie…" : "Dodaj zadanie"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
