import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useGoogleIntegration } from "../api/integrations";
import { OAUTH_STATUS_LABELS } from "../types/integration";
import { Calendar, Link2, Loader2, Settings } from "lucide-react";
import { useCalendarAuth } from "@/features/calendar/hooks/useCalendarAuth";

type Tab = "general" | "integrations";

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: "general", label: "Ogólne", icon: Settings },
  { key: "integrations", label: "Integracje", icon: Link2 },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-foreground">Ustawienia</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer flex-1 justify-center",
              tab === key
                ? "bg-card text-foreground shadow-sm"
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
    <div className="rounded-lg border border-border bg-card p-6">
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

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
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

  return (
    <div className="flex flex-col gap-4">
      {/* Google Calendar Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
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
              <div className="mt-4 rounded-md border border-border bg-muted/50 px-4 py-3">
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
