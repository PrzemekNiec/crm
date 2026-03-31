import { useState, useCallback } from "react";
import { Plus, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ClientList } from "./ClientList";
import { CreateClientDialog } from "./CreateClientDialog";
import { useClients } from "../api/useClients";
import { CLIENT_SOURCE_LABELS, type ClientSource } from "../types/client";
import { downloadCSV } from "@/lib/csv";

const CLIENT_CSV_COLUMNS = [
  { key: "firstName", label: "Imię" },
  { key: "lastName", label: "Nazwisko" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "E-mail" },
  { key: "source", label: "Źródło" },
  { key: "createdAt", label: "Data utworzenia" },
];

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: clients } = useClients();

  const handleExport = useCallback(() => {
    if (!clients?.length) return;

    const rows = clients.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone || "",
      email: c.email || "",
      source: CLIENT_SOURCE_LABELS[c.source as ClientSource] ?? c.source ?? "",
      createdAt: c.createdAt
        ? new Date(c.createdAt).toLocaleDateString("pl-PL")
        : "",
    }));

    const today = new Date().toISOString().slice(0, 10);
    downloadCSV(rows, CLIENT_CSV_COLUMNS, `klienci_${today}.csv`);
  }, [clients]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Klienci</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!clients?.length}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Eksportuj CSV</span>
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Dodaj klienta</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po imieniu, telefonie lub emailu…"
          className="pl-10"
        />
      </div>

      {/* Client list */}
      <ClientList searchQuery={search} />

      {/* Create dialog */}
      <CreateClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
