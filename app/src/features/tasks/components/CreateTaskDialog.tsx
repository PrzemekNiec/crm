import { useEffect, useRef } from "react";
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
import { ClientCombobox } from "@/components/ui/ClientCombobox";
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
  defaultClientId?: string;
  defaultClientName?: string;
  defaultType?: string;
  defaultDueDate?: string;
  defaultDurationMin?: number;
}

const TYPE_DEFAULT_DURATION: Record<string, number> = {
  call: 15,
  meeting: 90,
  followup: 15,
  docs: 30,
  check: 15,
  custom: 30,
};

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
  defaultClientId,
  defaultClientName,
  defaultType,
  defaultDueDate,
  defaultDurationMin,
}: CreateTaskDialogProps) {
  const createTask = useCreateTask();

  const hasDefaultClient = !!defaultClientId;

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
      clientId: defaultClientId ?? "",
      clientName: defaultClientName ?? "",
      type: (defaultType as TaskFormValues["type"]) ?? "call",
      title: "",
      description: "",
      dueDate: defaultDueDate ?? "",
      durationMin: defaultDurationMin ?? TYPE_DEFAULT_DURATION[(defaultType as string) ?? "call"] ?? 30,
      priority: "normal",
      syncToGoogleCalendar: true,
    },
  });

  // Auto-update duration when type changes (unless user manually edited)
  const durationTouched = useRef(false);
  const watchedType = watch("type");

  useEffect(() => {
    if (!durationTouched.current) {
      setValue("durationMin", TYPE_DEFAULT_DURATION[watchedType] ?? 30);
    }
  }, [watchedType, setValue]);

  // Reset touch flag when dialog opens
  useEffect(() => {
    if (open) durationTouched.current = false;
  }, [open]);

  const syncEnabled = watch("syncToGoogleCalendar");

  // Time options with 15-min intervals (06:00 – 21:00)
  const timeOptions = (() => {
    const opts = [{ value: "", label: "Bez godziny" }];
    for (let h = 6; h <= 21; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        opts.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
      }
    }
    return opts;
  })();

  const onClientSelect = (clientId: string, clientName: string) => {
    setValue("clientId", clientId);
    setValue("clientName", clientName);
  };

  const onSubmit = (values: TaskFormValues) => {
    createTask.mutate(values, {
      onSuccess: () => {
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
        {hasDefaultClient ? (
          <div className="flex flex-col gap-1.5">
            <Label>Klient</Label>
            <p className="text-sm font-medium text-foreground px-3 py-2 rounded-md border border-input bg-muted/30">
              {defaultClientName}
            </p>
            <input type="hidden" {...register("clientId")} />
            <input type="hidden" {...register("clientName")} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>Klient</Label>
            <ClientCombobox
              value={watch("clientId")}
              onChange={onClientSelect}
            />
            <input type="hidden" {...register("clientId")} />
            <input type="hidden" {...register("clientName")} />
          </div>
        )}

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

        {/* Due date + time + duration */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueDate">Data</Label>
            <Input
              id="dueDate"
              type="date"
              value={watch("dueDate")?.split("T")[0] ?? ""}
              onChange={(e) => {
                const date = e.target.value;
                const time = watch("dueDate")?.split("T")[1] ?? "";
                setValue("dueDate", date && time ? `${date}T${time}` : date ? `${date}T09:00` : "");
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueTime">Godzina</Label>
            <Select
              id="dueTime"
              options={timeOptions}
              value={watch("dueDate")?.split("T")[1] ?? ""}
              onChange={(e) => {
                const date = watch("dueDate")?.split("T")[0] ?? "";
                const time = e.target.value;
                setValue("dueDate", date && time ? `${date}T${time}` : date ? date : "");
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="durationMin">Czas trwania (minuty)</Label>
            <Input
              id="durationMin"
              type="number"
              min={5}
              max={480}
              {...register("durationMin", {
                onChange: () => { durationTouched.current = true; },
              })}
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
