import { z } from "zod";

// ─── Pipeline stages ─────────────────────────────────────────

export const DEAL_STAGES = [
  "contact",
  "analysis",
  "decision",
  "success",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  contact: "Nowy Wniosek",
  analysis: "Analiza / Dokumenty",
  decision: "Oczekiwanie na decyzję",
  success: "Uruchomiony / Sukces",
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  contact: "#60a5fa",    // blue-400
  analysis: "#fbbf24",   // amber-400
  decision: "#c084fc",   // purple-400
  success: "#34d399",    // emerald-400
};

// ─── Deal schema ─────────────────────────────────────────────

export const dealFormSchema = z.object({
  clientId: z.string().min(1, "Wybierz klienta"),
  title: z.string().min(1, "Tytuł jest wymagany"),
  value: z.number().min(0, "Kwota musi być >= 0"),
  stage: z.enum(DEAL_STAGES),
});

export type DealFormValues = z.infer<typeof dealFormSchema>;

// ─── DTO (from Firestore) ────────────────────────────────────

export interface DealDTO {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  value: number;
  stage: DealStage;
  createdAt: string; // ISO
}
