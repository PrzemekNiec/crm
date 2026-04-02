import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  collection,
  doc,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getFirebaseStorage } from "@/lib/firebase";
import { getDb } from "@/lib/firebase";

// ─── Document DTO ────────────────────────────────────────────

export interface DocumentDTO {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  storagePath: string;
  uploadedAt: string | null;
}

// ─── Query key ───────────────────────────────────────────────

export function documentsQueryKey(uid: string, clientId: string) {
  return ["documents", uid, clientId] as const;
}

// ─── Fetch documents ─────────────────────────────────────────

export async function fetchDocuments(
  uid: string,
  clientId: string
): Promise<DocumentDTO[]> {
  const db = getDb();
  const ref = collection(
    db,
    "users",
    uid,
    "clients",
    clientId,
    "documents"
  );
  const q = query(ref, orderBy("uploadedAt", "desc"));
  const snap = await getDocs(q);

  // Lazy backfill: sync hasDocuments flag if out of date
  const clientRef = doc(db, "users", uid, "clients", clientId);
  const hasAny = !snap.empty;
  const clientSnap = await (await import("firebase/firestore")).getDoc(clientRef);
  if (clientSnap.exists() && (clientSnap.data().hasDocuments ?? false) !== hasAny) {
    updateDoc(clientRef, { hasDocuments: hasAny }).catch(() => {});
  }

  return snap.docs.map((d) => {
    const data = d.data() as {
      name: string;
      url: string;
      type: string;
      size: number;
      storagePath: string;
      uploadedAt: Timestamp | null;
    };
    return {
      id: d.id,
      name: data.name ?? "",
      url: data.url ?? "",
      type: data.type ?? "",
      size: data.size ?? 0,
      storagePath: data.storagePath ?? "",
      uploadedAt:
        data.uploadedAt && typeof data.uploadedAt.toDate === "function"
          ? data.uploadedAt.toDate().toISOString()
          : null,
    };
  });
}

// ─── Upload document ─────────────────────────────────────────

export async function uploadDocument(
  uid: string,
  clientId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<DocumentDTO> {
  const storage = getFirebaseStorage();
  const storagePath = `users/${uid}/clients/${clientId}/documents/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  // Upload with progress tracking
  const uploadTask = uploadBytesResumable(storageRef, file);

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(percent);
      },
      (error) => {
        console.error("[Documents] Upload failed:", error.code, error.message);
        reject(error);
      },
      resolve
    );
  });

  const url = await getDownloadURL(storageRef);

  // Save metadata to Firestore
  const db = getDb();
  const colRef = collection(
    db,
    "users",
    uid,
    "clients",
    clientId,
    "documents"
  );
  const docRef = await addDoc(colRef, {
    name: file.name,
    url,
    type: file.type,
    size: file.size,
    storagePath,
    uploadedAt: serverTimestamp(),
  });

  // Mark client as having documents
  const clientRef = doc(db, "users", uid, "clients", clientId);
  await updateDoc(clientRef, { hasDocuments: true });

  return {
    id: docRef.id,
    name: file.name,
    url,
    type: file.type,
    size: file.size,
    storagePath,
    uploadedAt: new Date().toISOString(),
  };
}

// ─── Delete document ─────────────────────────────────────────

export async function deleteDocument(
  uid: string,
  clientId: string,
  documentId: string,
  storagePath: string
): Promise<void> {
  // Delete from Storage
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);

  // Delete metadata from Firestore
  const db = getDb();
  const docRef = doc(
    db,
    "users",
    uid,
    "clients",
    clientId,
    "documents",
    documentId
  );
  await deleteDoc(docRef);

  // Check if client still has documents — update flag
  const colRef = collection(db, "users", uid, "clients", clientId, "documents");
  const remaining = await getDocs(query(colRef, orderBy("uploadedAt", "desc")));
  const clientRef = doc(db, "users", uid, "clients", clientId);
  await updateDoc(clientRef, { hasDocuments: remaining.size > 0 });
}
