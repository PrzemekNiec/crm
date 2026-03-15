import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { convertLead, leadsQueryKey, type LeadDTO } from "./leads";
import { clientsQueryKey } from "@/features/clients/api/clients";
import { toast } from "@/components/ui/Toast";

export function useConvertLead() {
  const uid = useAuthStore((s) => s.user?.uid);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (lead: LeadDTO) => {
      if (!uid) throw new Error("Brak zalogowanego użytkownika");
      return convertLead(uid, lead);
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: leadsQueryKey(uid) });
        queryClient.invalidateQueries({ queryKey: clientsQueryKey(uid) });
      }
      toast.success("Lead pomyślnie skonwertowany na klienta!");
      navigate("/clients");
    },
    onError: () => {
      toast.error("Nie udało się skonwertować leada. Spróbuj ponownie.");
    },
  });
}
