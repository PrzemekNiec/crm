import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  documentsQueryKey,
} from "./documents";

/**
 * Fetches all documents for a given client.
 */
export function useClientDocuments(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: documentsQueryKey(uid ?? "", clientId ?? ""),
    queryFn: () => fetchDocuments(uid!, clientId!),
    enabled: !!uid && !!clientId,
  });
}

/**
 * Uploads a document and saves metadata. Supports progress callback.
 */
export function useUploadDocument(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (percent: number) => void;
    }) => uploadDocument(uid!, clientId!, file, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: documentsQueryKey(uid ?? "", clientId ?? ""),
      });
    },
  });
}

/**
 * Deletes a document from Storage and Firestore.
 */
export function useDeleteDocument(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      storagePath,
    }: {
      documentId: string;
      storagePath: string;
    }) => deleteDocument(uid!, clientId!, documentId, storagePath),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: documentsQueryKey(uid ?? "", clientId ?? ""),
      });
    },
  });
}
