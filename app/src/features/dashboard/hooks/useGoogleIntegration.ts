import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";

interface GoogleIntegration {
  connected: boolean;
  oauthStatus: string;
}

function integrationQueryKey(uid: string) {
  return ["google-integration", uid] as const;
}

async function fetchGoogleIntegration(
  uid: string
): Promise<GoogleIntegration | null> {
  const db = getDb();
  const ref = doc(db, "users", uid, "integrations", "google_workspace");
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    connected: data.connected ?? false,
    oauthStatus: data.oauthStatus ?? "unknown",
  };
}

export function useGoogleIntegration() {
  const uid = useAuthStore((s) => s.user?.uid);

  const query = useQuery({
    queryKey: integrationQueryKey(uid ?? ""),
    queryFn: () => fetchGoogleIntegration(uid!),
    enabled: !!uid,
    staleTime: 1000 * 60 * 2,
  });

  const needsReauth =
    query.data === null ||
    query.data?.oauthStatus === "reauth_required" ||
    query.data?.connected === false;

  return {
    ...query,
    needsReauth,
    oauthStatus: query.data?.oauthStatus ?? null,
  };
}
