import { z } from "zod";

// ─── Pipeline stages ─────────────────────────────────────────

export const DEAL_STAGES = [
  "potencjalne",
  "fi",
  "analiza",
  "decyzja",
  "umowa",
  "wyplata",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  potencjalne: "Potencjalne",
  fi: "FI",
  analiza: "Wysłane / analiza",
  decyzja: "Decyzja",
  umowa: "Umowa",
  wyplata: "Wypłata",
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  potencjalne: "#60a5fa",  // blue-400
  fi: "#fbbf24",           // amber-400
  analiza: "#c084fc",      // purple-400
  decyzja: "#f472b6",      // pink-400
  umowa: "#fb923c",        // orange-400
  wyplata: "#34d399",      // emerald-400
};

// ─── History entry ───────────────────────────────────────────

export interface DealHistoryEntry {
  stage: DealStage;
  timestamp: string; // ISO
}

// ─── Deal note entry ────────────────────────────────────────

export interface DealNoteEntry {
  text: string;
  createdAt: string; // ISO
}

// ─── Deal schema ─────────────────────────────────────────────

export const dealFormSchema = z.object({
  clientId: z.string().min(1, "Wybierz klienta"),
  title: z.string().min(1, "Tytuł jest wymagany"),
  value: z.number().min(0, "Kwota musi być >= 0"),
  stage: z.enum(DEAL_STAGES),
});

export type DealFormValues = z.infer<typeof dealFormSchema>;

// ─── Settlement schema ────────────────────────────────────────

export const settleDealSchema = z.object({
  bank: z.string().min(1, "Podaj bank"),
  commissionRate: z.number().min(0, "Stawka musi być >= 0"),
  commissionValue: z.number().min(0, "Prowizja musi być >= 0"),
  payoutDate: z.string().min(1, "Wybierz miesiąc wypłaty"),
  notes: z.string().optional(),
});

export type SettleDealValues = z.infer<typeof settleDealSchema>;

// ─── DTO (from Firestore) ────────────────────────────────────

export interface DealDTO {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  value: number;
  stage: DealStage;
  notes?: string;
  dealNotes?: DealNoteEntry[];
  isWatched?: boolean;
  isRegisteredInCP?: boolean;
  history: DealHistoryEntry[];
  createdAt: string; // ISO
  // Settlement fields
  isArchived?: boolean;
  bank?: string;
  commissionRate?: number;
  commissionValue?: number;
  payoutDate?: string; // YYYY-MM
  // Rejection fields
  isRejected?: boolean;
  rejectionReason?: string;
}
