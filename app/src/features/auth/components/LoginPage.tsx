import { signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { LogIn } from "lucide-react";
import { useState } from "react";

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(getFirebaseAuth(), googleProvider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nieznany błąd logowania";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-lg border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Doradca kredytowy — prywatny CRM
          </p>
        </div>

        <Button
          onClick={handleLogin}
          disabled={loading}
          size="lg"
          className="w-full"
        >
          <LogIn className="h-5 w-5" />
          {loading ? "Logowanie…" : "Zaloguj się przez Google"}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
