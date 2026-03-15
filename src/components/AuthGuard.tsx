import type { ReactNode } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { OnboardingWizard } from "@/features/auth/components/OnboardingWizard";
import { Loader2 } from "lucide-react";
import { isFirestoreInitialized } from "@/lib/firebase";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Guards the entire app behind authentication and onboarding.
 *
 * Flow:
 * 1. Auth loading → spinner
 * 2. Not logged in → LoginPage
 * 3. Logged in, no Firestore (first time, no persisted deviceMode) → OnboardingWizard
 * 4. Logged in, Firestore ready, no profile / onboarding not done → OnboardingWizard
 * 5. Logged in, onboarding done → children
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const authReady = useAuthStore((s) => s.authReady);
  const user = useAuthStore((s) => s.user);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  // 1. Still loading auth state
  if (!authReady) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // 3 & 4. Need onboarding (either no Firestore or no profile)
  if (!isFirestoreInitialized() || !onboardingCompleted) {
    return <OnboardingWizard />;
  }

  // 5. Fully authenticated and onboarded
  return <>{children}</>;
}
