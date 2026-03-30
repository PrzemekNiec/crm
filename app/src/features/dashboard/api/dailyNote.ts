import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

// ─── Query key ──────────────────────────────────────────────

export const dailyNoteQueryKey = (uid: string, date: string) =>
  ["dailyNote", uid, date] as const;

// ─── Fetch ──────────────────────────────────────────────────

export async function fetchDailyNote(
  uid: string,
  date: string
): Promise<string> {
  const db = getDb();
  const ref = doc(db, "users", uid, "dailyNotes", date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return "";
  return (snap.data() as { text?: string }).text ?? "";
}

// ─── Save ───────────────────────────────────────────────────

export async function saveDailyNote(
  uid: string,
  date: string,
  text: string
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "dailyNotes", date);
  await setDoc(ref, { text, updatedAt: serverTimestamp() }, { merge: true });
}
