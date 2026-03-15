import { z } from "zod";

// ─── Task types (PRD v3.1 §10.7) ────────────────────────────

export const TASK_TYPES = [
  "call",
  "meeting",
  "followup",
  "docs",
  "check",
  "custom",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  call: "Telefon",
  meeting: "Spotkanie",
  followup: "Follow-up",
  docs: "Dokumenty",
  check: "Kontrola statusu",
  custom: "Własne",
};

export const TASK_TYPE_EMOJI: Record<TaskType, string> = {
  call: "📞",
  meeting: "🤝",
  followup: "🔄",
  docs: "📄",
  check: "🔍",
  custom: "📌",
};

// ─── Task statuses ───────────────────────────────────────────

export const TASK_STATUSES = ["open", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Otwarte",
  done: "Wykonane",
  cancelled: "Anulowane",
};

// ─── Sync states (PRD v3.1 §11.4) ───────────────────────────

export const SYNC_STATES = [
  "not_required",
  "pending",
  "synced",
  "failed",
  "reauth_required",
] as const;
export type SyncState = (typeof SYNC_STATES)[number];

// ─── Priorities (reuse from clients) ─────────────────────────

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ─── Zod schema: form input ─────────────────────────────────

export const taskFormSchema = z.object({
  clientId: z.string().optional().default(""),
  clientName: z.string().optional().default(""),
  type: z.enum(TASK_TYPES),
  title: z.string().min(2, "Tytuł musi mieć co najmniej 2 znaki").max(200),
  description: z.string().max(2000),
  dueDate: z.string(), // ISO string from datetime-local input, empty = no due date
  durationMin: z.coerce.number().int().min(5).max(480),
  priority: z.enum(TASK_PRIORITIES),
  syncToGoogleCalendar: z.boolean(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

// ─── Frontend DTO (timestamps serialized) ────────────────────

export interface TaskDTO {
  id: string;
  clientId: string;
  clientName: string; // empty string when no client assigned
  type: TaskType;
  title: string;
  description: string;
  dueDate: string | null; // ISO string
  durationMin: number;
  priority: string;
  status: TaskStatus;
  completedAt: string | null;
  resultNote: string;
  syncToGoogleCalendar: boolean;
  syncRevision: number;
  lastProcessedSyncRevision: number | null;
  syncState: SyncState;
  syncErrorCode: string | null;
  syncErrorMessage: string | null;
  syncAttempts: number;
  googleEventId: string | null;
  googleEventHtmlLink: string | null;
  lastSyncedCalendarId: string | null;
  lastSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
