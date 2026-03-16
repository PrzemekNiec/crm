import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { ClientFormValues } from "../types/client";

// ─── Timestamp → ISO string helper ──────────────────────────

function timestampToISO(ts: Timestamp | null | undefined): string | null {
  if (!ts || typeof ts.toDate !== "function") return null;
  return ts.toDate().toISOString();
}

// ─── Raw Firestore document shape ────────────────────────────

interface ClientDoc {
  fullName: string;
  phone?: string;
  email?: string;
  preferredContactChannel?: string;
  leadSource?: string;
  productType?: string;
  loanAmount?: number;
  propertyValue?: number;
  downPayment?: number;
  bankPrimary?: string;
  stage: string;
  priority: string;
  mainNote?: string;
  tags?: string[];
  source?: string;
  referralName?: string;
  referralRate?: number;
  lastContactAt: Timestamp | null;
  nextActionAt: Timestamp | null;
  nextActionTaskId: string | null;
  archived: boolean;
  softDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Serialised client for the frontend ─────────────────────

/** Frontend-safe shape — timestamps are ISO strings. */
export interface ClientDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  preferredContactChannel?: string;
  leadSource: string;
  productType?: string;
  loanAmount?: number;
  propertyValue?: number;
  downPayment?: number;
  bankPrimary: string;
  stage: string;
  priority: string;
  mainNote: string;
  tags: string[];
  source: string;
  referralName?: string;
  referralRate?: number;
  lastContactAt: string | null;
  nextActionAt: string | null;
  nextActionTaskId: string | null;
  archived: boolean;
  softDeleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Firestore withConverter ─────────────────────────────────

export const clientConverter: FirestoreDataConverter<ClientDTO> = {
  toFirestore(client: ClientDTO): DocumentData {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = client;
    return rest;
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options?: SnapshotOptions
  ): ClientDTO {
    const d = snapshot.data(options) as ClientDoc;
    return {
      id: snapshot.id,
      fullName: d.fullName,
      phone: d.phone ?? "",
      email: d.email ?? "",
      preferredContactChannel: d.preferredContactChannel,
      leadSource: d.leadSource ?? "",
      productType: d.productType,
      loanAmount: d.loanAmount,
      propertyValue: d.propertyValue,
      downPayment: d.downPayment,
      bankPrimary: d.bankPrimary ?? "",
      stage: d.stage,
      priority: d.priority,
      mainNote: d.mainNote ?? "",
      tags: d.tags ?? [],
      source: d.source ?? "organic",
      referralName: d.referralName,
      referralRate: d.referralRate,
      lastContactAt: timestampToISO(d.lastContactAt),
      nextActionAt: timestampToISO(d.nextActionAt),
      nextActionTaskId: d.nextActionTaskId ?? null,
      archived: d.archived ?? false,
      softDeleted: d.softDeleted ?? false,
      createdAt: timestampToISO(d.createdAt),
      updatedAt: timestampToISO(d.updatedAt),
    };
  },
};

// ─── Query functions ─────────────────────────────────────────

export function clientsQueryKey(uid: string) {
  return ["clients", uid] as const;
}

/** Fetch all active (non-deleted, non-archived) clients. */
export async function fetchClients(uid: string): Promise<ClientDTO[]> {
  const db = getDb();
  const ref = collection(db, "users", uid, "clients").withConverter(
    clientConverter
  );

  const q = query(
    ref,
    where("softDeleted", "==", false),
    orderBy("updatedAt", "desc")
  );

  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/** Fetch a single client by ID. Returns null if not found. */
export async function fetchClient(
  uid: string,
  clientId: string
): Promise<ClientDTO | null> {
  const db = getDb();
  const ref = doc(db, "users", uid, "clients", clientId).withConverter(
    clientConverter
  );
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export function clientQueryKey(uid: string, clientId: string) {
  return ["clients", uid, clientId] as const;
}

/** Create a new client document. Returns the generated id. */
export async function createClient(
  uid: string,
  values: ClientFormValues
): Promise<string> {
  const db = getDb();
  const ref = collection(db, "users", uid, "clients");

  const docRef = await addDoc(ref, {
    ...values,
    lastContactAt: null,
    nextActionAt: null,
    nextActionTaskId: null,
    archived: false,
    softDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/** Update an existing client document. */
export async function updateClient(
  uid: string,
  clientId: string,
  values: Partial<ClientFormValues>
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "clients", clientId);
  await updateDoc(ref, {
    ...values,
    updatedAt: serverTimestamp(),
  });
}
