import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useGoogleIntegration } from "../api/integrations";
import { OAUTH_STATUS_LABELS } from "../types/integration";
import { Calendar, Link2, Loader2, Moon, RefreshCw, Settings, Sun, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { useCalendarAuth } from "@/features/calendar/hooks/useCalendarAuth";
import { useCalendarWatch } from "@/features/calendar/hooks/useCalendarWatch";
import { GLASS } from "@/lib/glass";
import { useTheme } from "@/lib/useTheme";
import { useAuthStore } from "@/store/useAuthStore";
import { createClient } from "@/features/clients/api/clients";
import { createDeal, archiveDeal } from "@/features/deals/api/deals";

type Tab = "general" | "integrations" | "import";

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: "general", label: "Ogólne", icon: Settings },
  { key: "integrations", label: "Integracje", icon: Link2 },
  { key: "import", label: "Import", icon: Upload },
];

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
                ? "bg-[var(--surface-8)] text-foreground shadow-sm"
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
      {tab === "import" && <ImportTab />}
    </div>
  );
}

// ─── General tab ─────────────────────────────────────────────

function GeneralTab() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="rounded-xl p-6" style={GLASS}>
      <h2 className="text-lg font-semibold text-foreground">Ogólne</h2>

      {/* Theme toggle */}
      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Motyw</p>
          <p className="text-xs text-muted-foreground">
            {isDark ? "Ciemny" : "Jasny"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors bg-[var(--surface-6)] hover:bg-[var(--surface-8)] text-foreground cursor-pointer"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Przełącz na jasny" : "Przełącz na ciemny"}
        </button>
      </div>
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
  const watchExpiration = integration?.calendar.watchExpiration ?? null;

  const now = Date.now();
  const watchExpired = watchExpiration != null && watchExpiration < now;
  const watchExpiringSoon = watchExpiration != null && !watchExpired && watchExpiration < now + 24 * 60 * 60 * 1000;

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
                    background: "var(--glass-bg)",
                    border: "1px solid var(--surface-6)",
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
                    background: "var(--glass-bg)",
                    border: "1px solid var(--surface-6)",
                  }}
                >
                  {watchChannelId ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw className={cn("h-4 w-4", watchExpired ? "text-red-500" : watchExpiringSoon ? "text-amber-500" : "text-emerald-500")} />
                        <p className="text-sm text-foreground">
                          Synchronizacja dwukierunkowa jest{" "}
                          {watchExpired ? (
                            <span className="font-medium text-red-500">wygasła</span>
                          ) : watchExpiringSoon ? (
                            <span className="font-medium text-amber-500">wygasa wkrótce</span>
                          ) : (
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">aktywna</span>
                          )}
                        </p>
                      </div>
                      {watchExpiration && (
                        <p className="text-xs text-muted-foreground">
                          {watchExpired ? "Wygasła" : "Ważna do"}: {new Date(watchExpiration).toLocaleString("pl-PL")}
                        </p>
                      )}
                      {(watchExpired || watchExpiringSoon) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isRegistering}
                          onClick={registerWatch}
                          className="self-start"
                        >
                          {isRegistering ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          {isRegistering ? "Odnawianie…" : "Odnów kanał"}
                        </Button>
                      )}
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

// ─── Import tab ─────────────────────────────────────────────

interface ImportRow {
  firstName: string;
  lastName: string;
  value: number;
  payoutDate: string; // YYYY-MM
  commissionValue: number;
  commissionRate: number;
}

const IMPORT_DATA: ImportRow[] = [
  { firstName: "Adrian", lastName: "Stachura", value: 200_000, payoutDate: "2026-01", commissionValue: 3_960, commissionRate: 1.98 },
  { firstName: "Patrycja", lastName: "Gwiżdż", value: 368_000, payoutDate: "2026-01", commissionValue: 6_624, commissionRate: 1.80 },
  { firstName: "Kamil", lastName: "Tomasikiewicz", value: 730_000, payoutDate: "2026-02", commissionValue: 13_213, commissionRate: 1.81 },
  { firstName: "Marek", lastName: "Soszka", value: 800_000, payoutDate: "2026-02", commissionValue: 14_400, commissionRate: 1.80 },
];

const MONTH_LABELS: Record<string, string> = {
  "2026-01": "Styczeń 2026",
  "2026-02": "Luty 2026",
  "2026-03": "Marzec 2026",
};

function formatPLN(v: number) {
  return v.toLocaleString("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ImportTab() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);

  async function handleImport() {
    if (!uid) return;
    setImporting(true);
    setResults([]);
    const newResults: typeof results = [];

    for (const row of IMPORT_DATA) {
      const name = `${row.firstName} ${row.lastName}`;
      try {
        // 1. Create client
        const clientId = await createClient(uid, {
          firstName: row.firstName,
          lastName: row.lastName,
          phone: "",
          email: "",
          leadSource: "",
          bankPrimary: "",
          stage: "closed_won",
          priority: "normal",
          mainNote: "",
          tags: [],
          source: "organic",
        });

        // 2. Create deal at stage "wyplata"
        const dealId = await createDeal(uid, {
          clientId,
          clientName: name,
          title: `Kredyt hipoteczny — ${name}`,
          value: row.value,
          stage: "wyplata",
        });

        // 3. Archive (settle) the deal
        await archiveDeal(uid, dealId, {
          bank: "",
          commissionRate: row.commissionRate,
          commissionValue: row.commissionValue,
          payoutDate: row.payoutDate,
        });

        newResults.push({ name, ok: true });
      } catch (e) {
        newResults.push({ name, ok: false, error: e instanceof Error ? e.message : "Nieznany błąd" });
      }
    }

    setResults(newResults);
    setImporting(false);
  }

  return (
    <div className="rounded-xl p-6" style={GLASS}>
      <h2 className="text-lg font-semibold text-foreground">Import archiwum 2026</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Import utworzy klientów i zamknięte sprawy (wypłaty) w jednym kroku.
        Pozostałe dane klientów uzupełnisz ręcznie.
      </p>

      {/* Preview table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--surface-6)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-6)] bg-[var(--surface-4)]">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Klient</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Kwota</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Wypłata</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Prowizja</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Stawka</th>
            </tr>
          </thead>
          <tbody>
            {IMPORT_DATA.map((row) => (
              <tr key={row.lastName} className="border-b border-[var(--surface-4)]">
                <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.firstName} {row.lastName}</td>
                <td className="px-3 py-2 text-right text-foreground">{formatPLN(row.value)}</td>
                <td className="px-3 py-2 text-muted-foreground">{MONTH_LABELS[row.payoutDate] ?? row.payoutDate}</td>
                <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400 font-medium">{formatPLN(row.commissionValue)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{row.commissionRate.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Import button */}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleImport} disabled={importing || results.length > 0}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? "Importowanie…" : results.length > 0 ? "Zaimportowano" : "Importuj dane"}
        </Button>
        {results.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {results.filter((r) => r.ok).length} z {results.length} zaimportowanych
          </span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4 space-y-1">
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-2 text-sm">
              {r.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={r.ok ? "text-foreground" : "text-red-500"}>
                {r.name}{r.error ? ` — ${r.error}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
