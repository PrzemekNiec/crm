import { z } from "zod";

// ─── Lead statuses ──────────────────────────────────────────

export const LEAD_STATUSES = ["new", "contacted", "converted", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nowy",
  contacted: "Skontaktowany",
  converted: "Przekonwertowany",
  lost: "Odrzucony",
};

export const LOSS_REASONS = [
  "Brak kontaktu",
  "Załatwił sam",
  "Brak zdolności",
  "Słaba oferta",
] as const;

// ─── Zod schema: quick add form ─────────────────────────────

export const leadFormSchema = z.object({
  fullName: z
    .string()
    .min(2, "Imię i nazwisko musi mieć co najmniej 2 znaki")
    .max(120, "Maksymalnie 120 znaków"),
  estimatedAmount: z.coerce.number().nonnegative().optional(),
  phone: z.string().max(20).optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
