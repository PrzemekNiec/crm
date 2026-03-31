import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { softDeleteClient, clientsQueryKey } from "./clients";
import { toast } from "@/components/ui/Toast";

export function useDeleteClient() {
  const uid = useAuthStore((s) => s.user?.uid);
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (clientId: string) => softDeleteClient(uid!, clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientsQueryKey(uid ?? "") });
      toast.success("Klient został usunięty z bazy.");
      navigate("/clients");
    },
    onError: () => {
      toast.error("Nie udało się usunąć klienta.");
    },
  });
}
