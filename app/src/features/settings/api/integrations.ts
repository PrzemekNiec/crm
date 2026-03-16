import {
  doc,
  getDoc,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
} from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { getDb } from "@/lib/firebase";
import {
  DEFAULT_GOOGLE_INTEGRATION,
  type GoogleIntegration,
} from "../types/integration";

// ─── Firestore withConverter ─────────────────────────────────

const integrationConverter: FirestoreDataConverter<GoogleIntegration> = {
  toFirestore(data: GoogleIntegration): DocumentData {
    return {
      provider: data.provider,
      connected: data.connected,
      oauthStatus: data.oauthStatus,
      calendar: data.calendar,
    };
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options?: SnapshotOptions
  ): GoogleIntegration {
    const d = snapshot.data(options);
    return {
      provider: "google_workspace",
      connected: d.connected ?? false,
      oauthStatus: d.oauthStatus ?? "disconnected",
      calendar: {
        enabled: d.calendar?.enabled ?? false,
        selectedCalendarId: d.calendar?.selectedCalendarId ?? null,
        selectedCalendarName: d.calendar?.selectedCalendarName ?? null,
        watchChannelId: d.calendar?.watchChannelId ?? null,
      },
    };
  },
};

// ─── Query key & fetch ───────────────────────────────────────

export function googleIntegrationQueryKey(uid: string) {
  return ["integrations", "google_workspace", uid] as const;
}

async function fetchGoogleIntegration(
  uid: string
): Promise<GoogleIntegration> {
  const db = getDb();
  const ref = doc(
    db,
    "users",
    uid,
    "integrations",
    "google_workspace"
  ).withConverter(integrationConverter);

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return DEFAULT_GOOGLE_INTEGRATION;
  }

  return snap.data();
}

// ─── React hook ──────────────────────────────────────────────

export function useGoogleIntegration() {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: googleIntegrationQueryKey(uid ?? ""),
    queryFn: () => fetchGoogleIntegration(uid!),
    enabled: !!uid,
  });
}
