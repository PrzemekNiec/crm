import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "@/lib/firebase";
import { toast } from "@/components/ui/Toast";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

interface ConnectResponse {
  success: boolean;
}

export function useCalendarAuth() {
  const [isConnecting, setIsConnecting] = useState(false);

  const exchangeCode = async (code: string) => {
    toast.success("Łączenie z Google...");

    try {
      const connectFn = httpsCallable<{ code: string }, ConnectResponse>(
        getFunctions(),
        "connectGoogleCalendar"
      );
      await connectFn({ code });

      toast.success("Kalendarz połączony pomyślnie!");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nieznany błąd";
      console.error("connectGoogleCalendar failed:", message);
      toast.error("Nie udało się połączyć kalendarza. Spróbuj ponownie.");
    } finally {
      setIsConnecting(false);
    }
  };

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: CALENDAR_SCOPES,
    // access_type='offline' and prompt='consent' are handled server-side
    // during token exchange in the Cloud Function.
    select_account: true,
    onSuccess: (codeResponse) => {
      exchangeCode(codeResponse.code);
    },
    onError: (errorResponse) => {
      console.error("Google OAuth error:", errorResponse);
      setIsConnecting(false);
      toast.error("Nie udało się połączyć z Google. Spróbuj ponownie.");
    },
    onNonOAuthError: (error) => {
      console.error("Non-OAuth error:", error);
      setIsConnecting(false);
      toast.error("Wystąpił błąd podczas łączenia z Google.");
    },
  });

  const startOAuth = () => {
    setIsConnecting(true);
    login();
  };

  return { startOAuth, isConnecting };
}
