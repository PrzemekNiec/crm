import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { DealDTO, DealFormValues, DealStage } from "../types/deal";

// ─── Firestore converter ────────────────────────────────────

const dealConverter: FirestoreDataConverter<DealDTO> = {
  toFirestore(deal: DealDTO): DocumentData {
    return {
      clientId: deal.clientId,
      clientName: deal.clientName ?? null,
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      createdAt: deal.createdAt,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options?: SnapshotOptions
  ): DealDTO {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      clientId: d.clientId ?? "",
      clientName: d.clientName ?? undefined,
      title: d.title ?? "",
      value: d.value ?? 0,
      stage: d.stage ?? "contact",
      createdAt: d.createdAt?.toDate?.()
        ? d.createdAt.toDate().toISOString()
        : new Date().toISOString(),
    };
  },
};

// ─── Query keys ─────────────────────────────────────────────

export function dealsQueryKey(uid: string) {
  return ["deals", uid] as const;
}

// ─── Fetch all deals ────────────────────────────────────────

export async function fetchDeals(uid: string): Promise<DealDTO[]> {
  const db = getDb();
  const ref = collection(db, "users", uid, "deals").withConverter(
    dealConverter
  );
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// ─── Create deal ────────────────────────────────────────────

export async function createDeal(
  uid: string,
  values: DealFormValues & { clientName?: string }
): Promise<string> {
  const db = getDb();
  const ref = collection(db, "users", uid, "deals");
  const docRef = await addDoc(ref, {
    clientId: values.clientId,
    clientName: values.clientName ?? null,
    title: values.title,
    value: values.value,
    stage: values.stage ?? "contact",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ─── Update deal stage ──────────────────────────────────────

export async function updateDealStage(
  uid: string,
  dealId: string,
  stage: DealStage
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "deals", dealId);
  await updateDoc(ref, {
    stage,
    updatedAt: serverTimestamp(),
  });
}
