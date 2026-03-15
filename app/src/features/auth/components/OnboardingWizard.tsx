import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuthStore } from "@/store/useAuthStore";
import { getDb, initFirestore, isFirestoreInitialized } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Shield, Globe, ChevronRight, Check } from "lucide-react";
import type { DeviceMode } from "@/types/user";

type Step = "device" | "preferences" | "done";

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function OnboardingWizard() {
  const user = useAuthStore((s) => s.user);
  const setDeviceMode = useAuthStore((s) => s.setDeviceMode);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [step, setStep] = useState<Step>("device");
  const [selectedMode, setSelectedMode] = useState<DeviceMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleDeviceSelect = (mode: DeviceMode) => {
    setSelectedMode(mode);

    // Initialize Firestore immediately with chosen cache strategy
    if (!isFirestoreInitialized()) {
      setDeviceMode(mode);
    }
  };

  const handleFinish = async () => {
    if (!selectedMode) return;

    setSaving(true);
    setError(null);

    try {
      // Ensure Firestore is ready
      if (!isFirestoreInitialized()) {
        initFirestore(selectedMode);
      }

      const db = getDb();
      const userRef = doc(db, "users", user.uid);

      const profile = {
        uid: user.uid,
        displayName: user.displayName ?? "",
        email: user.email ?? "",
        photoURL: user.photoURL ?? null,
        timezone: TIMEZONE,
        deviceMode: selectedMode,
        authPersistenceMode:
          selectedMode === "trusted" ? "local" : "session",
        calendarCompletionBehavior: "keep_mark_done",
        defaultEventDurationMin: 30,
        defaultReminderMin: 15,
        inactiveClientAlertDays: 14,
        onboardingCompleted: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, profile);

      // Hydrate store — serverTimestamp() resolves to null locally
      // before sync, but that's fine — profile exists.
      setProfile({
        ...profile,
        createdAt: null,
        lastLoginAt: null,
        updatedAt: null,
        onboardingCompleted: true,
      } as never);

      setStep("done");
    } catch (err) {
      console.error("[Onboarding] Error saving profile:", err);
      setError("Nie udało się zapisać profilu. Spróbuj ponownie.");
      setSaving(false);
    }
  };

  // ─── Step: Device mode ───────────────────────────────────
  if (step === "device") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
          <h1 className="mb-2 text-xl font-bold text-foreground">
            Witaj w CRM
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Czy korzystasz z tego urządzenia prywatnie?
            To wpływa na to, jak aplikacja przechowuje dane lokalnie.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleDeviceSelect("trusted")}
              className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                selectedMode === "trusted"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <Shield className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <div className="font-medium text-foreground">
                  Urządzenie prywatne
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Dane będą dostępne offline i między sesjami.
                  Szybsze działanie, pełna funkcjonalność offline.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDeviceSelect("shared")}
              className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                selectedMode === "shared"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <Globe className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
              <div>
                <div className="font-medium text-foreground">
                  Urządzenie współdzielone
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Dane nie będą zapisywane lokalnie. Sesja kończy się po
                  zamknięciu przeglądarki.
                </div>
              </div>
            </button>
          </div>

          <Button
            onClick={() => setStep("preferences")}
            disabled={!selectedMode}
            className="mt-6 w-full"
          >
            Dalej
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step: Preferences confirmation & save ───────────────
  if (step === "preferences") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
          <h1 className="mb-2 text-xl font-bold text-foreground">
            Ustawienia domyślne
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Możesz je zmienić później w ustawieniach.
          </p>

          <div className="flex flex-col gap-4 text-sm">
            <div className="flex justify-between rounded-md bg-muted px-4 py-3">
              <span className="text-muted-foreground">Strefa czasowa</span>
              <span className="font-medium text-foreground">{TIMEZONE}</span>
            </div>
            <div className="flex justify-between rounded-md bg-muted px-4 py-3">
              <span className="text-muted-foreground">Długość wydarzenia</span>
              <span className="font-medium text-foreground">30 min</span>
            </div>
            <div className="flex justify-between rounded-md bg-muted px-4 py-3">
              <span className="text-muted-foreground">Przypomnienie</span>
              <span className="font-medium text-foreground">15 min przed</span>
            </div>
            <div className="flex justify-between rounded-md bg-muted px-4 py-3">
              <span className="text-muted-foreground">Tryb urządzenia</span>
              <span className="font-medium text-foreground">
                {selectedMode === "trusted" ? "Prywatne" : "Współdzielone"}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            onClick={handleFinish}
            disabled={saving}
            className="mt-6 w-full"
          >
            {saving ? "Zapisywanie…" : "Zakończ i przejdź do aplikacji"}
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step: Done (brief, auto-redirect would happen via store) ─
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <Check className="h-12 w-12 text-success" />
        <h1 className="text-xl font-bold text-foreground">Gotowe!</h1>
        <p className="text-sm text-muted-foreground">
          Przekierowuję do aplikacji…
        </p>
      </div>
    </div>
  );
}
