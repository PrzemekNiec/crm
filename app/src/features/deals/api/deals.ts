import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  arrayUnion,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type {
  DealDTO,
  DealFormValues,
  DealStage,
  DealHistoryEntry,
  SettleDealValues,
} from "../types/deal";

// ─── Firestore converter ────────────────────────────────────

const dealConverter: FirestoreDataConverter<DealDTO> = {
  toFirestore(deal: DealDTO): DocumentData {
    return {
      clientId: deal.clientId,
      clientName: deal.clientName ?? null,
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      notes: deal.notes ?? "",
      isRegisteredInCP: deal.isRegisteredInCP ?? false,
      history: deal.history ?? [],
      createdAt: deal.createdAt,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options?: SnapshotOptions
  ): DealDTO {
    const d = snapshot.data(options);

    // Parse history entries
    const rawHistory = (d.history as Array<Record<string, unknown>>) ?? [];
    const history: DealHistoryEntry[] = rawHistory.map((h) => ({
      stage: (h.stage as DealStage) ?? "potencjalne",
      timestamp:
        h.timestamp &&
        typeof h.timestamp === "object" &&
        "toDate" in h.timestamp &&
        typeof (h.timestamp as Record<string, unknown>).toDate === "function"
          ? ((h.timestamp as Record<string, () => Date>).toDate() as unknown as Date).toISOString()
          : typeof h.timestamp === "string"
            ? h.timestamp
            : new Date().toISOString(),
    }));

    return {
      id: snapshot.id,
      clientId: d.clientId ?? "",
      clientName: d.clientName ?? undefined,
      title: d.title ?? "",
      value: d.value ?? 0,
      stage: d.stage ?? "potencjalne",
      notes: d.notes ?? "",
      isRegisteredInCP: d.isRegisteredInCP ?? false,
      history,
      createdAt: d.createdAt?.toDate?.()
        ? d.createdAt.toDate().toISOString()
        : new Date().toISOString(),
      // Settlement fields
      isArchived: d.isArchived ?? false,
      bank: d.bank ?? undefined,
      commissionRate: d.commissionRate ?? undefined,
      commissionValue: d.commissionValue ?? undefined,
      payoutDate: d.payoutDate ?? undefined,
      // Rejection fields
      isRejected: d.isRejected ?? false,
      rejectionReason: d.rejectionReason ?? undefined,
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
  const stage = values.stage ?? "potencjalne";
  const now = new Date().toISOString();

  const docRef = await addDoc(ref, {
    clientId: values.clientId,
    clientName: values.clientName ?? null,
    title: values.title,
    value: values.value,
    stage,
    isRegisteredInCP: false,
    history: [{ stage, timestamp: now }],
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
  const now = new Date().toISOString();

  await updateDoc(ref, {
    stage,
    history: arrayUnion({ stage, timestamp: now }),
    updatedAt: serverTimestamp(),
  });
}

// ─── Update deal title ──────────────────────────────────────

export async function updateDealTitle(
  uid: string,
  dealId: string,
  title: string
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "deals", dealId);
  await updateDoc(ref, {
    title,
    updatedAt: serverTimestamp(),
  });
}

// ─── Update deal notes ──────────────────────────────────────

export async function updateDealNotes(
  uid: string,
  dealId: string,
  notes: string
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "deals", dealId);
  await updateDoc(ref, {
    notes,
    updatedAt: serverTimestamp(),
  });
}

// ─── Toggle CP registration ────────────────────────────────

export async function toggleCPRegistration(
  uid: string,
  dealId: string,
  value: boolean
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "deals", dealId);
  await updateDoc(ref, {
    isRegisteredInCP: value,
    updatedAt: serverTimestamp(),
  });
}

// ─── Update deal commission ─────────────────────────────────

export async function updateDealCommission(
  uid: string,
  dealId: string,
  rate: number,
  value: number
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "deals", dealId);
  await updateDoc(ref, {
    commissionRate: rate,
    commissionValue: value,
    updatedAt: serverTimestamp(),
  });
}

// ─── Archive deal (settlement) ──────────────────────────────

export async function archiveDeal(
  uid: string,
  dealId: string,
  values: SettleDealValues
): Promise<void> {
  const db = getDb();
  const ref = doc(db, "users", uid, "deals", dealId);
  await updateDoc(ref, {
    isArchived: true,
    bank: values.bank,
    commissionRate: values.commissionRate,
    commissionValue: values.commissionValue,
    payoutDate: values.payoutDate,
    notes: values.notes ?? "",
    updatedAt: serverTimestamp(),
  });
}

// ─── Reject deal (negative decision) ───────────────────────

export interface RejectDealResult {
  cancelledTaskIds: string[];
}

export async function rejectDeal(
  uid: string,
  dealId: string,
  clientId: string,
  reason: string
): Promise<RejectDealResult> {
  const db = getDb();
  const batch = writeBatch(db);

  // 1. Update deal document
  const dealRef = doc(db, "users", uid, "deals", dealId);
  batch.update(dealRef, {
    isArchived: true,
    isRejected: true,
    rejectionReason: reason || "",
    updatedAt: serverTimestamp(),
  });

  // 2. Cascade: cancel all open tasks for this client
  const cancelledTaskIds: string[] = [];

  if (clientId) {
    const tasksRef = collection(db, "users", uid, "tasks");
    const q = query(
      tasksRef,
      where("clientId", "==", clientId),
      where("status", "==", "open")
    );
    const snap = await getDocs(q);

    for (const taskDoc of snap.docs) {
      batch.update(taskDoc.ref, {
        status: "system_cancelled",
        updatedAt: serverTimestamp(),
      });
      cancelledTaskIds.push(taskDoc.id);
    }
  }

  // 3. Commit atomic batch
  await batch.commit();

  return { cancelledTaskIds };
}
