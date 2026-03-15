import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { TaskFormValues } from "../types/task";
import type { TaskDTO } from "../types/task";

// ─── Deterministic Google Calendar Event ID ──────────────────
//
// PRD v3.1 §13.3: Event ID derived from uid + taskId, encoded
// as base32hex (lowercase a-v + 0-9, 5-1024 chars).
// Google Calendar requires: [a-v0-9]{5,1024}

function toBase32Hex(input: string): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuv";
  const bytes = new TextEncoder().encode(input);
  let bits = 0;
  let value = 0;
  let result = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

export function generateGoogleEventId(uid: string, taskId: string): string {
  const raw = `${uid}:${taskId}`;
  const encoded = toBase32Hex(raw);
  // Ensure minimum 5 chars (always will be for realistic UIDs)
  return encoded.length >= 5 ? encoded : encoded.padEnd(5, "0");
}

// ─── Timestamp helper ────────────────────────────────────────

function timestampToISO(ts: Timestamp | null | undefined): string | null {
  if (!ts || typeof ts.toDate !== "function") return null;
  return ts.toDate().toISOString();
}

// ─── Raw Firestore document shape ────────────────────────────

interface TaskDoc {
  clientId: string;
  clientName: string;
  type: string;
  title: string;
  description: string;
  dueAt: Timestamp | null;
  durationMin: number;
  priority: string;
  status: string;
  completedAt: Timestamp | null;
  resultNote: string;
  syncToGoogleCalendar: boolean;
  syncRevision: number;
  lastProcessedSyncRevision: number | null;
  syncState: string;
  syncErrorCode: string | null;
  syncErrorMessage: string | null;
  syncAttempts: number;
  googleEventId: string | null;
  googleEventHtmlLink: string | null;
  lastSyncedCalendarId: string | null;
  lastSyncedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Firestore converter ─────────────────────────────────────

export const taskConverter: FirestoreDataConverter<TaskDTO> = {
  toFirestore(task: TaskDTO): DocumentData {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = task;
    return rest;
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options?: SnapshotOptions
  ): TaskDTO {
    const d = snapshot.data(options) as TaskDoc;
    return {
      id: snapshot.id,
      clientId: d.clientId,
      clientName: d.clientName,
      type: d.type as TaskDTO["type"],
      title: d.title,
      description: d.description ?? "",
      dueDate: timestampToISO(d.dueAt),
      durationMin: d.durationMin ?? 30,
      priority: d.priority ?? "normal",
      status: d.status as TaskDTO["status"],
      completedAt: timestampToISO(d.completedAt),
      resultNote: d.resultNote ?? "",
      syncToGoogleCalendar: d.syncToGoogleCalendar ?? false,
      syncRevision: d.syncRevision ?? 1,
      lastProcessedSyncRevision: d.lastProcessedSyncRevision ?? null,
      syncState: (d.syncState as TaskDTO["syncState"]) ?? "not_required",
      syncErrorCode: d.syncErrorCode ?? null,
      syncErrorMessage: d.syncErrorMessage ?? null,
      syncAttempts: d.syncAttempts ?? 0,
      googleEventId: d.googleEventId ?? null,
      googleEventHtmlLink: d.googleEventHtmlLink ?? null,
      lastSyncedCalendarId: d.lastSyncedCalendarId ?? null,
      lastSyncedAt: timestampToISO(d.lastSyncedAt),
      createdAt: timestampToISO(d.createdAt),
      updatedAt: timestampToISO(d.updatedAt),
    };
  },
};

// ─── Query keys & functions ──────────────────────────────────

export function tasksQueryKey(uid: string) {
  return ["tasks", uid] as const;
}

/** Fetch all open + recent tasks for the current user. */
export async function fetchTasks(uid: string): Promise<TaskDTO[]> {
  const db = getDb();
  const ref = collection(db, "users", uid, "tasks").withConverter(
    taskConverter
  );

  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/** Fetch open tasks for a specific client. */
export async function fetchClientTasks(
  uid: string,
  clientId: string
): Promise<TaskDTO[]> {
  const db = getDb();
  const ref = collection(db, "users", uid, "tasks").withConverter(
    taskConverter
  );

  const q = query(
    ref,
    where("clientId", "==", clientId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// ─── Mutations ───────────────────────────────────────────────

export interface CreateTaskPayload extends TaskFormValues {
  uid: string;
}

/**
 * Create a new task with a pre-generated document ID and
 * a deterministic Google Calendar event ID.
 */
export async function createTask(payload: CreateTaskPayload): Promise<string> {
  const { uid, dueDate, ...formValues } = payload;
  const db = getDb();
  const colRef = collection(db, "users", uid, "tasks");

  // Pre-generate document ID so we can derive googleEventId
  const taskRef = doc(colRef);
  const taskId = taskRef.id;
  const googleEventId = generateGoogleEventId(uid, taskId);

  const hasDueDate = dueDate !== "";
  const shouldSync = formValues.syncToGoogleCalendar && hasDueDate;

  await setDoc(taskRef, {
    ...formValues,
    dueAt: hasDueDate ? new Date(dueDate) : null,
    status: "open",
    completedAt: null,
    resultNote: "",
    syncToGoogleCalendar: formValues.syncToGoogleCalendar,
    syncRevision: 1,
    lastProcessedSyncRevision: null,
    syncState: shouldSync ? "pending" : "not_required",
    syncErrorCode: null,
    syncErrorMessage: null,
    syncAttempts: 0,
    googleEventId,
    googleEventHtmlLink: null,
    lastSyncedCalendarId: null,
    lastSyncedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return taskId;
}
