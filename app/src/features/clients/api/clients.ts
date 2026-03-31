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
  writeBatch,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { splitFullName, joinName } from "@/lib/format";
import type { ClientFormValues } from "../types/client";

// ─── Dual-read helper (migration) ───────────────────────────

/** Extract firstName/lastName from a Firestore doc, with fallback to fullName. */
function extractNames(data: Record<string, unknown>): { firstName: string; lastName: string } {
  if (typeof data.firstName === "string" && typeof data.lastName === "string") {
    return { firstName: data.firstName, lastName: data.lastName };
  }
  if (typeof data.fullName === "string") {
    return splitFullName(data.fullName);
  }
  return { firstName: "", lastName: "" };
}

// ─── Phone normalization ─────────────────────────────────────

/** Strip spaces, dashes, dots, parens — keep leading '+' and digits only. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

// ─── Duplicate check ────────────────────────────────────────

export interface DuplicateMatch {
  id: string;
  firstName: string;
  lastName: string;
  field: "phone" | "email";
  source: "client" | "lead";
}

/**
 * Check if a client with the same phone or email already exists.
 * Pass `excludeId` when editing to skip the client being edited.
 */
export async function checkDuplicate(
  uid: string,
  phone: string,
  email: string,
  excludeId?: string
): Promise<DuplicateMatch | null> {
  const db = getDb();
  const clientsRef = collection(db, "users", uid, "clients");
  const leadsRef = collection(db, "users", uid, "leads");
  const normalizedPhone = normalizePhone(phone);

  // Check phone in clients AND leads in parallel
  if (normalizedPhone) {
    const [clientSnap, leadSnap] = await Promise.all([
      getDocs(query(clientsRef, where("phone", "==", normalizedPhone), where("softDeleted", "==", false))),
      getDocs(query(leadsRef, where("phone", "==", normalizedPhone), where("softDeleted", "==", false))),
    ]);
    for (const d of clientSnap.docs) {
      if (d.id !== excludeId) {
        const data = d.data() as Record<string, unknown>;
        const { firstName, lastName } = extractNames(data);
        return { id: d.id, firstName, lastName, field: "phone", source: "client" };
      }
    }
    for (const d of leadSnap.docs) {
      if (d.id !== excludeId) {
        const data = d.data() as Record<string, unknown>;
        const { firstName, lastName } = extractNames(data);
        return { id: d.id, firstName, lastName, field: "phone", source: "lead" };
      }
    }
  }

  // Check email in clients only (leads don't have email)
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail) {
    const q = query(clientsRef, where("email", "==", trimmedEmail), where("softDeleted", "==", false));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id !== excludeId) {
        const data = d.data() as Record<string, unknown>;
        const { firstName, lastName } = extractNames(data);
        return { id: d.id, firstName, lastName, field: "email", source: "client" };
      }
    }
  }

  return null;
}

// ─── Timestamp → ISO string helper ──────────────────────────

function timestampToISO(ts: Timestamp | null | undefined): string | null {
  if (!ts || typeof ts.toDate !== "function") return null;
  return ts.toDate().toISOString();
}

// ─── Raw Firestore document shape ────────────────────────────

interface ClientDoc {
  firstName?: string;
  lastName?: string;
  fullName?: string; // legacy — dual-read migration
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
  convertedFromLeadId?: string;
  convertedAt?: Timestamp | null;
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
  firstName: string;
  lastName: string;
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
  convertedFromLeadId?: string;
  convertedAt?: string | null;
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
    const names = extractNames(d as unknown as Record<string, unknown>);
    return {
      id: snapshot.id,
      firstName: names.firstName,
      lastName: names.lastName,
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
      convertedFromLeadId: d.convertedFromLeadId,
      convertedAt: timestampToISO(d.convertedAt ?? null),
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

  // Strip undefined values — Firestore rejects them
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) clean[k] = v;
  }
  // Normalize phone & email before save
  if (typeof clean.phone === "string") clean.phone = normalizePhone(clean.phone as string);
  if (typeof clean.email === "string") clean.email = (clean.email as string).trim().toLowerCase();

  // Dual-write: store firstName + lastName + computed fullName for backward compat
  if (typeof clean.firstName === "string" && typeof clean.lastName === "string") {
    clean.fullName = joinName(clean.firstName as string, clean.lastName as string);
  }

  const docRef = await addDoc(ref, {
    ...clean,
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

/** Update an existing client document.
 *  When fullName changes, propagates to denormalized clientName in deals & tasks.
 */
export async function updateClient(
  uid: string,
  clientId: string,
  values: Partial<ClientFormValues>
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "clients", clientId);
  // Strip undefined values — Firestore rejects them
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) clean[k] = v;
  }
  // Normalize phone & email before save
  if (typeof clean.phone === "string") clean.phone = normalizePhone(clean.phone as string);
  if (typeof clean.email === "string") clean.email = (clean.email as string).trim().toLowerCase();

  // Dual-write: keep fullName in sync
  if (typeof clean.firstName === "string" || typeof clean.lastName === "string") {
    // Need both names for computed fullName — read current if only one changed
    const fn = (clean.firstName as string | undefined) ?? undefined;
    const ln = (clean.lastName as string | undefined) ?? undefined;
    if (fn !== undefined || ln !== undefined) {
      // If we don't have both, fetch current values
      let currentFirst = fn;
      let currentLast = ln;
      if (currentFirst === undefined || currentLast === undefined) {
        const currentSnap = await getDoc(ref);
        if (currentSnap.exists()) {
          const current = currentSnap.data() as Record<string, unknown>;
          const currentNames = extractNames(current);
          if (currentFirst === undefined) currentFirst = currentNames.firstName;
          if (currentLast === undefined) currentLast = currentNames.lastName;
        }
      }
      const computedFullName = joinName(currentFirst ?? "", currentLast ?? "");
      clean.fullName = computedFullName;

      const batch = writeBatch(db);
      batch.update(ref, clean);

      // Propagate to deals
      const dealsSnap = await getDocs(
        query(collection(db, "users", uid, "deals"), where("clientId", "==", clientId))
      );
      for (const d of dealsSnap.docs) {
        batch.update(d.ref, { clientName: computedFullName });
      }

      // Propagate to tasks
      const tasksSnap = await getDocs(
        query(collection(db, "users", uid, "tasks"), where("clientId", "==", clientId))
      );
      for (const t of tasksSnap.docs) {
        batch.update(t.ref, { clientName: computedFullName });
      }

      await batch.commit();
    } else {
      await updateDoc(ref, clean);
    }
  } else {
    await updateDoc(ref, clean);
  }
}
