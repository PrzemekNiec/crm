import { z } from "zod/v4";

// ─── OAuth status ────────────────────────────────────────────

export const OAUTH_STATUSES = ["active", "reauth_required", "disconnected"] as const;
export type OAuthStatus = (typeof OAUTH_STATUSES)[number];

export const OAUTH_STATUS_LABELS: Record<OAuthStatus, string> = {
  active: "Aktywne",
  reauth_required: "Wymagana ponowna autoryzacja",
  disconnected: "Rozłączono",
};

// ─── Calendar sub-object ─────────────────────────────────────

export const calendarSettingsSchema = z.object({
  enabled: z.boolean(),
  selectedCalendarId: z.string().nullable(),
  selectedCalendarName: z.string().nullable(),
});

export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;

// ─── Google Workspace integration document ───────────────────

export const googleIntegrationSchema = z.object({
  provider: z.literal("google_workspace"),
  connected: z.boolean(),
  oauthStatus: z.enum(OAUTH_STATUSES),
  calendar: calendarSettingsSchema,
});

export type GoogleIntegration = z.infer<typeof googleIntegrationSchema>;

// ─── Default (disconnected) state ────────────────────────────

export const DEFAULT_GOOGLE_INTEGRATION: GoogleIntegration = {
  provider: "google_workspace",
  connected: false,
  oauthStatus: "disconnected",
  calendar: {
    enabled: false,
    selectedCalendarId: null,
    selectedCalendarName: null,
  },
};
