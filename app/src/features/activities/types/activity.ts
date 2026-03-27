// ─── Activity types (Faza 3: Zunifikowany Timeline) ─────────

export const ACTIVITY_TYPES = [
  "TASK_CREATED",
  "TASK_COMPLETED",
  "TASK_RESCHEDULED",
  "TASK_CANCELLED",
  "NOTE_MANUAL",
  "LEAD_CONVERTED",
  "DEAL_WON",
  "DEAL_REJECTED",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  TASK_CREATED: "Utworzono zadanie",
  TASK_COMPLETED: "Zakończono zadanie",
  TASK_RESCHEDULED: "Przełożono zadanie",
  TASK_CANCELLED: "Anulowano zadanie",
  NOTE_MANUAL: "Notatka",
  LEAD_CONVERTED: "Skonwertowano leada",
  DEAL_WON: "Wygrana szansa",
  DEAL_REJECTED: "Odrzucona szansa",
};

export const ACTIVITY_TYPE_EMOJI: Record<ActivityType, string> = {
  TASK_CREATED: "📋",
  TASK_COMPLETED: "✅",
  TASK_RESCHEDULED: "🔄",
  TASK_CANCELLED: "❌",
  NOTE_MANUAL: "📝",
  LEAD_CONVERTED: "🎯",
  DEAL_WON: "🏆",
  DEAL_REJECTED: "👎",
};

// ─── Activity metadata ──────────────────────────────────────

export interface ActivityMetadata {
  oldDate?: string;
  newDate?: string;
  taskTitle?: string;
  taskType?: string;
  dealTitle?: string;
  rejectionReason?: string;
}

// ─── Activity DTO (frontend) ────────────────────────────────

export interface ActivityDTO {
  id: string;
  clientId: string | null;
  taskId: string | null;
  dealId: string | null;
  type: ActivityType;
  note: string;
  metadata: ActivityMetadata;
  createdAt: string | null;
}
