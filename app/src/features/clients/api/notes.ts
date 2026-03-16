import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

// ─── Note DTO ────────────────────────────────────────────────

export interface NoteDTO {
  id: string;
  content: string;
  createdAt: string | null;
}

// ─── Query key ───────────────────────────────────────────────

export function notesQueryKey(uid: string, clientId: string) {
  return ["notes", uid, clientId] as const;
}

// ─── Fetch notes ─────────────────────────────────────────────

export async function fetchNotes(
  uid: string,
  clientId: string
): Promise<NoteDTO[]> {
  const db = getDb();
  const ref = collection(
    db,
    "users",
    uid,
    "clients",
    clientId,
    "notes"
  );
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as { content: string; createdAt: Timestamp | null };
    return {
      id: d.id,
      content: data.content ?? "",
      createdAt:
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : null,
    };
  });
}

// ─── Create note ─────────────────────────────────────────────

export async function createNote(
  uid: string,
  clientId: string,
  content: string
): Promise<string> {
  const db = getDb();
  const ref = collection(
    db,
    "users",
    uid,
    "clients",
    clientId,
    "notes"
  );
  const docRef = await addDoc(ref, {
    content,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
