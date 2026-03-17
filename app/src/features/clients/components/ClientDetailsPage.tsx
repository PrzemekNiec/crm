import { useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  Pencil,
  FileText,
  ClipboardList,
  FolderOpen,
  Send,
  Calendar,
  Clock,
  User,
  Upload,
  Image,
  File,
  Trash2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/Toast";
import { useClient } from "../api/useClient";
import { useNotes, useCreateNote } from "../api/useNotes";
import {
  useClientDocuments,
  useUploadDocument,
  useDeleteDocument,
} from "../api/useDocuments";
import { EditClientDialog } from "./EditClientDialog";
import { useTasks } from "@/features/tasks/api/useTasks";
import { TaskActions } from "@/features/tasks/components/TaskList";
import { CreateTaskDialog } from "@/features/tasks/components/CreateTaskDialog";
import {
  STAGE_LABELS,
  CLIENT_SOURCE_LABELS,
  type ClientStage,
  type ClientSource,
} from "../types/client";
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_EMOJI,
  type TaskType,
} from "@/features/tasks/types/task";
import { useDeals, useCreateDeal } from "@/features/deals/api/useDeals";
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
  dealFormSchema,
  type DealStage,
  type DealFormValues,
} from "@/features/deals/types/deal";
import { cn } from "@/lib/cn";

// ─── Glassmorphism card style ────────────────────────────────

const glassStyle: React.CSSProperties = {
  background: "rgba(30, 41, 59, 0.5)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
};

// ─── Tabs ────────────────────────────────────────────────────

type Tab = "notes" | "tasks" | "documents" | "deals";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "notes", label: "Oś czasu", icon: <FileText className="h-4 w-4" /> },
  {
    key: "tasks",
    label: "Zadania",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    key: "documents",
    label: "Dokumenty",
    icon: <FolderOpen className="h-4 w-4" />,
  },
  {
    key: "deals",
    label: "Szanse",
    icon: <span className="text-sm leading-none">💰</span>,
  },
];

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Przed chwilą";
  if (diffMin < 60)
    return `${diffMin} ${diffMin === 1 ? "minutę" : diffMin < 5 ? "minuty" : "minut"} temu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)
    return `${diffH} ${diffH === 1 ? "godzinę" : diffH < 5 ? "godziny" : "godzin"} temu`;
  return formatDate(iso);
}

// ─── Skeleton ────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="rounded-xl p-6 animate-pulse" style={glassStyle}>
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ─── Notes Tab ───────────────────────────────────────────────

function NotesTab({ clientId }: { clientId: string }) {
  const { data: notes, isLoading } = useNotes(clientId);
  const createNote = useCreateNote(clientId);
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    createNote.mutate(trimmed, {
      onSuccess: () => setContent(""),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Add note form */}
      <form onSubmit={handleSubmit} className="rounded-xl p-4" style={glassStyle}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Zapisz notatkę z rozmowy, ustalenia, spostrzeżenia…"
          rows={3}
          className="w-full resize-none rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="mt-3 flex justify-end">
          <Button
            type="submit"
            disabled={!content.trim() || createNote.isPending}
          >
            <Send className="h-4 w-4" />
            {createNote.isPending ? "Zapisywanie…" : "Dodaj notatkę"}
          </Button>
        </div>
      </form>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={glassStyle}
            >
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : !notes || notes.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl p-12 text-center"
          style={glassStyle}
        >
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Brak notatek. Dodaj pierwszą notatkę powyżej.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl p-4" style={glassStyle}>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {note.content}
              </p>
              {note.createdAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatRelative(note.createdAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tasks Tab ───────────────────────────────────────────────

function TasksTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: allTasks, isLoading } = useTasks();
  const [createOpen, setCreateOpen] = useState(false);

  const clientTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t) => t.clientId === clientId);
  }, [allTasks, clientId]);

  const header = (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground">
        {clientTasks.length > 0 ? `${clientTasks.length} zadań` : ""}
      </span>
      <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Dodaj zadanie
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 animate-pulse"
            style={glassStyle}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {header}
      {clientTasks.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl p-12 text-center"
          style={glassStyle}
        >
          <ClipboardList className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Brak zadań powiązanych z tym klientem.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {clientTasks.map((task) => {
            const isDone = task.status === "done" || task.status === "cancelled" || task.status === "system_cancelled";
            return (
              <div
                key={task.id}
                className={`rounded-xl p-4 ${isDone ? "opacity-60" : ""}`}
                style={{
                  ...glassStyle,
                  background: isDone
                    ? "rgba(30, 41, 59, 0.3)"
                    : "rgba(30, 41, 59, 0.5)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg leading-none">
                    {TASK_TYPE_EMOJI[task.type as TaskType] ?? "📌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`font-medium text-foreground ${isDone ? "line-through" : ""}`}
                      >
                        {task.title}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {TASK_TYPE_LABELS[task.type as TaskType] ?? task.type}
                      </Badge>
                      {task.status === "done" && (
                        <Badge variant="success">Wykonane</Badge>
                      )}
                      {task.status === "cancelled" && (
                        <Badge variant="warning">Anulowane</Badge>
                      )}
                      {task.status === "system_cancelled" && (
                        <Badge variant="destructive">Anulowane (system)</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(task.dueDate)} {formatTime(task.dueDate)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.durationMin} minut
                      </span>
                    </div>
                  </div>
                  <TaskActions task={task} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultClientId={clientId}
        defaultClientName={clientName}
      />
    </>
  );
}

// ─── Documents Tab ───────────────────────────────────────────

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-5 w-5 text-blue-400" />;
  if (type === "application/pdf") return <FileText className="h-5 w-5 text-red-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsTab({ clientId }: { clientId: string }) {
  const { data: documents, isLoading } = useClientDocuments(clientId);
  const upload = useUploadDocument(clientId);
  const remove = useDeleteDocument(clientId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      fileArray.forEach((file) => {
        setUploadProgress(0);
        upload.mutate(
          {
            file,
            onProgress: (p) => setUploadProgress(Math.round(p)),
          },
          {
            onSuccess: () => {
              setUploadProgress(null);
              toast.success(`Plik "${file.name}" został wgrany.`);
            },
            onError: (err) => {
              setUploadProgress(null);
              console.error("[Documents] Upload mutation error:", err);
              toast.error(`Nie udało się wgrać pliku "${file.name}".`);
            },
          }
        );
      });
    },
    [upload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDelete = (documentId: string, storagePath: string, name: string) => {
    remove.mutate(
      { documentId, storagePath },
      {
        onSuccess: () => toast.success(`Plik "${name}" został usunięty.`),
        onError: () => toast.error(`Nie udało się usunąć pliku "${name}".`),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl p-8 text-center cursor-pointer transition-all border-2 border-dashed",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-white/[0.12] hover:border-primary/50 hover:bg-white/[0.02]"
        )}
        style={{
          background: isDragging ? "rgba(201, 149, 107, 0.08)" : "rgba(30, 41, 59, 0.5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        }}
      >
        <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")} />
        <div>
          <p className="text-sm font-medium text-foreground">
            {isDragging ? "Upuść plik tutaj" : "Przeciągnij plik lub kliknij, aby wybrać"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, zdjęcia, dokumenty
          </p>
        </div>
        {uploadProgress !== null && (
          <div className="w-full max-w-xs">
            <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${uploadProgress}%`,
                  background: "linear-gradient(90deg, #c9956b, #a97c50)",
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{uploadProgress}%</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={glassStyle}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !documents || documents.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl p-12 text-center"
          style={glassStyle}
        >
          <FolderOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Brak dokumentów. Wgraj pierwszy plik powyżej.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-xl p-4" style={glassStyle}>
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                  {fileIcon(doc.type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.size)}</span>
                    {doc.uploadedAt && <span>{formatDate(doc.uploadedAt)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Otwórz"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 text-primary transition-all hover:bg-primary hover:text-white cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id, doc.storagePath, doc.name)}
                    disabled={remove.isPending}
                    title="Usuń plik"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 text-red-500 transition-all hover:bg-red-500 hover:text-white cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Deals Tab ──────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function DealsTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: allDeals, isLoading } = useDeals();
  const createDeal = useCreateDeal();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const clientDeals = useMemo(() => {
    if (!allDeals) return [];
    return allDeals.filter((d) => d.clientId === clientId);
  }, [allDeals, clientId]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      clientId,
      title: "",
      value: 0,
      stage: "potencjalne" as const,
    },
  });

  const onSubmit = (values: DealFormValues) => {
    createDeal.mutate(
      { ...values, clientName },
      {
        onSuccess: () => {
          reset();
          setCreateOpen(false);
        },
      }
    );
  };

  const header = (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground">
        {clientDeals.length > 0 ? `${clientDeals.length} szans` : ""}
      </span>
      <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Dodaj szansę
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 animate-pulse" style={glassStyle}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {header}
      {clientDeals.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-xl p-12 text-center"
          style={glassStyle}
        >
          <span className="text-4xl">💰</span>
          <p className="text-sm text-muted-foreground">
            Brak szans sprzedażowych dla tego klienta.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/pipeline")}>
            Przejdź do lejka sprzedaży
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {clientDeals.map((deal) => {
            const stageColor = DEAL_STAGE_COLORS[deal.stage as DealStage];
            const stageLabel = DEAL_STAGE_LABELS[deal.stage as DealStage] ?? deal.stage;

            return (
              <div
                key={deal.id}
                className="rounded-xl p-4 cursor-pointer transition-all hover:ring-1 hover:ring-white/20"
                style={{
                  ...glassStyle,
                  borderLeft: `3px solid ${stageColor}`,
                }}
                onClick={() => navigate("/pipeline")}
                title="Otwórz w lejku sprzedażowym"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {deal.title}
                    </p>
                    <p className="mt-1 text-base font-semibold text-primary">
                      {formatCurrency(deal.value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {deal.isRejected && (
                      <Badge variant="destructive" className="text-[9px]">Odrzucony</Badge>
                    )}
                    {deal.isArchived && !deal.isRejected && (
                      <Badge variant="success" className="text-[9px]">Zarchiwizowany</Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs"
                      style={{ borderColor: stageColor, color: stageColor }}
                    >
                      {stageLabel}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create deal dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Nowa szansa sprzedażowa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Klient</Label>
            <p className="text-sm font-medium text-foreground px-3 py-2 rounded-md border border-input bg-muted/30">
              {clientName}
            </p>
            <input type="hidden" {...register("clientId")} />
          </div>
          <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-1.5">
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending ? "Dodawanie..." : "Dodaj"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export function ClientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading, isError } = useClient(id);
  const [tab, setTab] = useState<Tab>("notes");
  const [editOpen, setEditOpen] = useState(false);

  // ─── Loading ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <HeaderSkeleton />
      </div>
    );
  }

  // ─── Not found / Error ───────────────────────────────────
  if (isError || !client) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div
          className="flex flex-col items-center gap-3 rounded-xl p-12 text-center"
          style={glassStyle}
        >
          <User className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">
            Nie znaleziono klienta
          </p>
          <Button variant="outline" onClick={() => navigate("/clients")}>
            <ArrowLeft className="h-4 w-4" />
            Wróć do listy klientów
          </Button>
        </div>
      </div>
    );
  }

  // ─── Initials avatar ────────────────────────────────────
  const initials = client.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sourceLabel =
    CLIENT_SOURCE_LABELS[client.source as ClientSource] ?? client.source;
  const stageLabel =
    STAGE_LABELS[client.stage as ClientStage] ?? client.stage;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate("/clients")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Wszyscy klienci
      </button>

      {/* Header card */}
      <div className="rounded-xl p-6" style={glassStyle}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: avatar + info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{
                background:
                  "linear-gradient(135deg, #c9956b 0%, #a97c50 100%)",
              }}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">
                {client.fullName}
              </h1>

              {/* Contact info */}
              <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
                {client.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {client.phone}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{stageLabel}</Badge>
                <Badge variant="default">{sourceLabel}</Badge>
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex gap-2 shrink-0">
            {client.phone && (
              <a href={`tel:${client.phone}`}>
                <Button variant="outline" size="sm">
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Zadzwoń</span>
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edytuj</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={glassStyle}
      >
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer flex-1 justify-center",
              tab === key
                ? "bg-white/[0.08] text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "notes" && id && <NotesTab clientId={id} />}
      {tab === "tasks" && id && <TasksTab clientId={id} clientName={client.fullName} />}
      {tab === "documents" && id && <DocumentsTab clientId={id} />}
      {tab === "deals" && id && <DealsTab clientId={id} clientName={client.fullName} />}

      {/* Edit client dialog */}
      <EditClientDialog
        client={client}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
