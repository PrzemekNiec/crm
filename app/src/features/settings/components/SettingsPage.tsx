import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useGoogleIntegration } from "../api/integrations";
import { OAUTH_STATUS_LABELS } from "../types/integration";
import { Calendar, Link2, Loader2, RefreshCw, Settings } from "lucide-react";
import { useCalendarAuth } from "@/features/calendar/hooks/useCalendarAuth";
import { useCalendarWatch } from "@/features/calendar/hooks/useCalendarWatch";

type Tab = "general" | "integrations";

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: "general", label: "Ogólne", icon: Settings },
  { key: "integrations", label: "Integracje", icon: Link2 },
];

const GLASS = {
  background: "rgba(30, 41, 59, 0.5)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
} as const;

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-foreground">Ustawienia</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={GLASS}>
        {TABS.map(({ key, label, icon: Icon }) => (
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
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "general" && <GeneralTab />}
      {tab === "integrations" && <IntegrationsTab />}
    </div>
  );
}

// ─── General tab ─────────────────────────────────────────────

function GeneralTab() {
  return (
    <div className="rounded-xl p-6" style={GLASS}>
      <h2 className="text-lg font-semibold text-foreground">Ogólne</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ustawienia ogólne będą dostępne w kolejnych wersjach aplikacji.
      </p>
    </div>
  );
}

// ─── Integrations tab ────────────────────────────────────────

function IntegrationsTab() {
  const { data: integration, isLoading } = useGoogleIntegration();
  const { startOAuth, isConnecting } = useCalendarAuth();
  const { registerWatch, isRegistering } = useCalendarWatch();

  if (isLoading) {
    return (
      <div className="rounded-xl p-6 animate-pulse" style={GLASS}>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="h-4 w-64 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const connected = integration?.connected ?? false;
  const oauthStatus = integration?.oauthStatus ?? "disconnected";
  const calendarName = integration?.calendar.selectedCalendarName;
  const watchChannelId = integration?.calendar.watchChannelId ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Google Calendar Card */}
      <div className="rounded-xl p-6" style={GLASS}>
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/20">
            <Calendar className="h-6 w-6 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-semibold text-foreground">
                Google Calendar
              </h3>
              {connected ? (
                <Badge variant="success">Połączono</Badge>
              ) : (
                <Badge variant="secondary">Niepołączono</Badge>
              )}
              {connected && oauthStatus === "reauth_required" && (
                <Badge variant="destructive">
                  {OAUTH_STATUS_LABELS.reauth_required}
                </Badge>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {connected
                ? "Zadania z terminem będą automatycznie synchronizowane z Twoim kalendarzem."
                : "Połącz swoje konto Google, aby synchronizować zadania z kalendarzem."}
            </p>

            {/* Calendar info or connect button */}
            {connected ? (
              <>
                <div
                  className="mt-4 rounded-md px-4 py-3"
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  {calendarName ? (
                    <p className="text-sm text-foreground">
                      <span className="text-muted-foreground">Wybrany kalendarz: </span>
                      <span className="font-medium">{calendarName}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-warning-foreground">
                      Nie wybrano kalendarza. Kliknij poniżej, aby wybrać kalendarz do synchronizacji.
                    </p>
                  )}
                </div>

                {/* Two-way sync */}
                <div
                  className="mt-3 rounded-md px-4 py-3"
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  {watchChannelId ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-emerald-500" />
                      <p className="text-sm text-foreground">
                        Synchronizacja dwukierunkowa jest{" "}
                        <span className="font-medium text-emerald-400">aktywna</span>
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Włącz synchronizację dwukierunkową, aby zmiany w Google Calendar aktualizowały zadania w CRM.
                      </p>
                      <Button
                        size="sm"
                        disabled={isRegistering}
                        onClick={registerWatch}
                        className="shrink-0"
                      >
                        {isRegistering ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {isRegistering ? "Aktywowanie…" : "Włącz dwukierunkową synchronizację"}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Button
                className="mt-4"
                disabled={isConnecting}
                onClick={startOAuth}
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                {isConnecting
                  ? "Łączenie z Google..."
                  : "Połącz z Kalendarzem Google"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
