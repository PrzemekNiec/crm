import { z } from "zod";
import type { Timestamp } from "firebase/firestore";

// ─── Pipeline stages (PRD v3.1 §10.6) ───────────────────────

export const CLIENT_STAGES = [
  "new_lead",
  "first_contact",
  "needs_analysis",
  "docs_collection",
  "application_prep",
  "application_submitted",
  "awaiting_decision",
  "decision_positive",
  "finalization",
  "closed_won",
  "closed_lost",
  "dormant",
] as const;

export type ClientStage = (typeof CLIENT_STAGES)[number];

export const TERMINAL_STAGES: readonly ClientStage[] = [
  "closed_won",
  "closed_lost",
  "dormant",
];

export const STAGE_LABELS: Record<ClientStage, string> = {
  new_lead: "Nowy lead",
  first_contact: "Pierwszy kontakt",
  needs_analysis: "Analiza potrzeb",
  docs_collection: "Dokumenty w kompletacji",
  application_prep: "Wniosek przygotowywany",
  application_submitted: "Wniosek złożony",
  awaiting_decision: "Oczekiwanie na decyzję",
  decision_positive: "Decyzja pozytywna",
  finalization: "Finalizacja",
  closed_won: "Zamknięty — wygrany",
  closed_lost: "Zamknięty — przegrany",
  dormant: "Uśpiony",
};

// ─── Priority ────────────────────────────────────────────────

export const PRIORITIES = ["low", "normal", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Niski",
  normal: "Normalny",
  high: "Wysoki",
};

// ─── Contact channels ────────────────────────────────────────

export const CONTACT_CHANNELS = [
  "phone",
  "email",
  "whatsapp",
  "other",
] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  phone: "Telefon",
  email: "E-mail",
  whatsapp: "WhatsApp",
  other: "Inny",
};

// ─── Product types ───────────────────────────────────────────

export const PRODUCT_TYPES = [
  "mortgage",
  "cash",
  "business",
  "consolidation",
  "other",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  mortgage: "Kredyt hipoteczny",
  cash: "Kredyt gotówkowy",
  business: "Kredyt firmowy",
  consolidation: "Konsolidacja",
  other: "Inny",
};

// ─── Client source ───────────────────────────────────────────

export const CLIENT_SOURCES = ["organic", "referral", "converted"] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number];

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  organic: "Własny",
  referral: "Pośrednik",
  converted: "Skonwertowany lead",
};

// ─── Zod schema: form input (create / edit) ──────────────────

export const clientFormSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Imię i nazwisko musi mieć co najmniej 2 znaki")
      .max(120, "Maksymalnie 120 znaków"),
    phone: z.string().max(20),
    email: z.string().email("Nieprawidłowy adres e-mail").or(z.literal("")),
    preferredContactChannel: z.enum(CONTACT_CHANNELS).optional(),
    leadSource: z.string().max(100),
    productType: z.enum(PRODUCT_TYPES).optional(),
    loanAmount: z.coerce.number().nonnegative().optional(),
    propertyValue: z.coerce.number().nonnegative().optional(),
    downPayment: z.coerce.number().nonnegative().optional(),
    bankPrimary: z.string().max(100),
    stage: z.enum(CLIENT_STAGES),
    priority: z.enum(PRIORITIES),
    mainNote: z.string().max(5000),
    tags: z.array(z.string().max(50)).max(20),
    source: z.enum(CLIENT_SOURCES).default("organic"),
    referralName: z.string().max(120).optional(),
    referralRate: z.coerce
      .number()
      .min(0, "Stawka nie może być ujemna")
      .max(100, "Stawka nie może przekraczać 100%")
      .optional(),
  })
  .refine(
    (data) =>
      data.source !== "referral" ||
      (data.referralName && data.referralName.trim().length > 0),
    {
      message: "Podaj nazwę pośrednika",
      path: ["referralName"],
    }
  );

export type ClientFormValues = z.infer<typeof clientFormSchema>;

// ─── Full Firestore document type ────────────────────────────

export interface Client extends ClientFormValues {
  id: string;
  lastContactAt: Timestamp | null;
  nextActionAt: Timestamp | null;
  nextActionTaskId: string | null;
  archived: boolean;
  softDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
