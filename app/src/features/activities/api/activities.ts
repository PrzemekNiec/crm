import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  writeBatch,
  doc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { ActivityDTO, ActivityType, ActivityMetadata } from "../types/activity";

// ─── Timestamp helper ────────────────────────────────────────

function timestampToISO(ts: Timestamp | null | undefined): string | null {
  if (!ts || typeof ts.toDate !== "function") return null;
  return ts.toDate().toISOString();
}

// ─── Raw Firestore document shape ────────────────────────────

interface ActivityDoc {
  clientId: string | null;
  taskId: string | null;
  dealId: string | null;
  type: string;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: Timestamp | null;
}

// ─── Mapper ──────────────────────────────────────────────────

function docToDTO(id: string, d: ActivityDoc): ActivityDTO {
  return {
    id,
    clientId: d.clientId ?? null,
    taskId: d.taskId ?? null,
    dealId: d.dealId ?? null,
    type: d.type as ActivityDTO["type"],
    note: d.note ?? "",
    metadata: (d.metadata ?? {}) as ActivityMetadata,
    createdAt: timestampToISO(d.createdAt),
  };
}

// ─── Query keys ──────────────────────────────────────────────

export function clientActivitiesQueryKey(uid: string, clientId: string) {
  return ["activities", "client", uid, clientId] as const;
}

export function taskActivitiesQueryKey(uid: string, taskId: string) {
  return ["activities", "task", uid, taskId] as const;
}

// ─── Fetch by client ─────────────────────────────────────────

export async function fetchActivitiesByClient(
  uid: string,
  clientId: string
): Promise<ActivityDTO[]> {
  const db = getDb();
  const ref = collection(db, "users", uid, "activities");
  const q = query(
    ref,
    where("clientId", "==", clientId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToDTO(d.id, d.data() as ActivityDoc));
}

// ─── Fetch by task ───────────────────────────────────────────

export async function fetchActivitiesByTask(
  uid: string,
  taskId: string
): Promise<ActivityDTO[]> {
  const db = getDb();
  const ref = collection(db, "users", uid, "activities");
  const q = query(
    ref,
    where("taskId", "==", taskId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToDTO(d.id, d.data() as ActivityDoc));
}

// ─── Create activity (standalone) ────────────────────────────

export interface CreateActivityPayload {
  clientId: string | null;
  taskId: string | null;
  dealId: string | null;
  type: ActivityType;
  note: string;
  metadata: ActivityMetadata;
}

export async function createActivity(
  uid: string,
  data: CreateActivityPayload
): Promise<string> {
  const db = getDb();
  const ref = collection(db, "users", uid, "activities");
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ─── Log task activity (batch: update task + create activity) ─

export interface LogTaskActivityPayload {
  taskId: string;
  clientId: string | null;
  type: ActivityType;
  note?: string;
  metadata?: ActivityMetadata;
  taskUpdate: Record<string, unknown>;
}

export async function logTaskActivity(
  uid: string,
  payload: LogTaskActivityPayload
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  // 1. Update the task document
  const taskRef = doc(db, "users", uid, "tasks", payload.taskId);
  batch.update(taskRef, {
    ...payload.taskUpdate,
    updatedAt: serverTimestamp(),
  });

  // 2. Create activity document
  const activityRef = doc(collection(db, "users", uid, "activities"));
  batch.set(activityRef, {
    clientId: payload.clientId,
    taskId: payload.taskId,
    dealId: null,
    type: payload.type,
    note: payload.note ?? "",
    metadata: payload.metadata ?? {},
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}
