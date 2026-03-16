import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchNotes, createNote, notesQueryKey } from "./notes";

/**
 * Fetches all notes for a given client.
 */
export function useNotes(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery({
    queryKey: notesQueryKey(uid ?? "", clientId ?? ""),
    queryFn: () => fetchNotes(uid!, clientId!),
    enabled: !!uid && !!clientId,
  });
}

/**
 * Creates a new note for a given client and invalidates the cache.
 */
export function useCreateNote(clientId: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => createNote(uid!, clientId!, content),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: notesQueryKey(uid ?? "", clientId ?? ""),
      });
    },
  });
}
