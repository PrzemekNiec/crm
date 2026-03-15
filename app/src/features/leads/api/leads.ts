import {
  collection,
  doc,
  query,
  orderBy,
  getDocs,
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
import type { LeadFormValues } from "../types/lead";

// ─── Firestore document shape ───────────────────────────────

interface LeadDoc {
  fullName: string;
  estimatedAmount?: number;
  phone?: string;
  status: string;
  createdAt: Timestamp;
}

// ─── Frontend DTO ───────────────────────────────────────────

export interface LeadDTO {
  id: string;
  fullName: string;
  estimatedAmount?: number;
  phone?: string;
  status: string;
  createdAt: string | null;
}

// ─── Converter ──────────────────────────────────────────────

function timestampToISO(ts: Timestamp | null | undefined): string | null {
  if (!ts || typeof ts.toDate !== "function") return null;
  return ts.toDate().toISOString();
}

export const leadConverter: FirestoreDataConverter<LeadDTO> = {
  toFirestore(lead: LeadDTO): DocumentData {
    const { id: _id, createdAt: _c, ...rest } = lead;
    return rest;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options?: SnapshotOptions
  ): LeadDTO {
    const d = snapshot.data(options) as LeadDoc;
    return {
      id: snapshot.id,
      fullName: d.fullName,
      estimatedAmount: d.estimatedAmount,
      phone: d.phone,
      status: d.status ?? "new",
      createdAt: timestampToISO(d.createdAt),
    };
  },
};

// ─── Query functions ────────────────────────────────────────

export function leadsQueryKey(uid: string) {
  return ["leads", uid] as const;
}

export async function fetchLeads(uid: string): Promise<LeadDTO[]> {
  const db = getDb();
  const ref = collection(db, "users", uid, "leads").withConverter(
    leadConverter
  );
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

export async function createLead(
  uid: string,
  values: LeadFormValues
): Promise<string> {
  const db = getDb();
  const ref = collection(db, "users", uid, "leads");
  const docRef = await addDoc(ref, {
    ...values,
    status: "new",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ─── Convert lead to client ─────────────────────────────────

export async function convertLead(
  uid: string,
  lead: LeadDTO
): Promise<string> {
  const db = getDb();

  // 1. Create client document
  const clientRef = collection(db, "users", uid, "clients");
  const clientDoc = await addDoc(clientRef, {
    fullName: lead.fullName,
    phone: lead.phone ?? "",
    email: "",
    leadSource: "",
    bankPrimary: "",
    mainNote: "",
    tags: [],
    stage: "first_contact",
    priority: "normal",
    source: "converted",
    loanAmount: lead.estimatedAmount ?? null,
    lastContactAt: null,
    nextActionAt: null,
    nextActionTaskId: null,
    archived: false,
    softDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Update lead status
  const leadRef = doc(db, "users", uid, "leads", lead.id);
  await updateDoc(leadRef, {
    status: "converted",
    convertedClientId: clientDoc.id,
  });

  return clientDoc.id;
}
