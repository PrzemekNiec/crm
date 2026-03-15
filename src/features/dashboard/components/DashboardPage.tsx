import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

export function DashboardPage() {
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex flex-1 flex-col p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Witaj, {profile?.displayName ?? "Użytkowniku"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Wyloguj
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            Zadania na dziś
          </h2>
          <p className="mt-2 text-3xl font-bold text-foreground">0</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            Zaległe
          </h2>
          <p className="mt-2 text-3xl font-bold text-destructive">0</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            Aktywni klienci
          </h2>
          <p className="mt-2 text-3xl font-bold text-foreground">0</p>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Faza 1 — rdzeń CRM zostanie zaimplementowany w następnym kroku.
      </p>
    </div>
  );
}
