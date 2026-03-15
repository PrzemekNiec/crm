import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "@/components/ui/Toast";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

export function useCalendarAuth() {
  const [isConnecting, setIsConnecting] = useState(false);

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: CALENDAR_SCOPES,
    // Note: access_type='offline' and prompt='consent' are set server-side
    // when exchanging the auth code via Cloud Function (to get a refresh token).
    // select_account prompts user to pick a Google account.
    select_account: true,
    onSuccess: (codeResponse) => {
      console.log("Google Auth Code:", codeResponse.code);
      // TODO: Send code to Cloud Function for token exchange
      setIsConnecting(false);
      toast.success("Kod autoryzacji uzyskany. Trwa łączenie z kalendarzem…");
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
