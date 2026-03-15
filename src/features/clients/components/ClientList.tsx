import { useMemo } from "react";
import { useClients } from "../api/useClients";
import { Badge } from "@/components/ui/Badge";
import {
  STAGE_LABELS,
  PRIORITY_LABELS,
  type ClientStage,
  type Priority,
} from "../types/client";
import type { ClientDTO } from "../api/clients";
import { Users, Phone, Mail } from "lucide-react";

// ─── Stage badge variant mapping ─────────────────────────────

function stageBadgeVariant(
  stage: string
): "default" | "secondary" | "success" | "destructive" | "warning" {
  switch (stage) {
    case "closed_won":
      return "success";
    case "closed_lost":
      return "destructive";
    case "dormant":
      return "warning";
    case "new_lead":
    case "first_contact":
      return "default";
    default:
      return "secondary";
  }
}

function priorityBadgeVariant(
  priority: string
): "default" | "destructive" | "warning" | "secondary" {
  switch (priority) {
    case "high":
      return "destructive";
    case "normal":
      return "secondary";
    case "low":
      return "default";
    default:
      return "secondary";
  }
}

// ─── Skeleton loader ─────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-md bg-card p-4 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-muted" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div className="h-5 w-20 rounded-full bg-muted" />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

interface ClientListProps {
  searchQuery: string;
}

export function ClientList({ searchQuery }: ClientListProps) {
  const { data: clients, isLoading, isError } = useClients();

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!searchQuery.trim()) return clients;

    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c: ClientDTO) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  // ─── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-card p-8 text-center">
        <p className="text-sm text-destructive">
          Nie udało się pobrać listy klientów. Spróbuj odświeżyć stronę.
        </p>
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────────
  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">Brak klientów</p>
        <p className="text-sm text-muted-foreground">
          Dodaj pierwszego klienta, klikając przycisk powyżej.
        </p>
      </div>
    );
  }

  // ─── No search results ────────────────────────────────────
  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Brak wyników dla &quot;{searchQuery}&quot;
        </p>
      </div>
    );
  }

  // ─── Desktop table ────────────────────────────────────────
  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Imię i nazwisko</th>
              <th className="px-4 py-3">Kontakt</th>
              <th className="px-4 py-3">Etap</th>
              <th className="px-4 py-3">Priorytet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((client) => (
              <tr
                key={client.id}
                className="bg-card transition-colors hover:bg-accent/50"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {client.fullName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5 text-muted-foreground">
                    {client.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </span>
                    )}
                    {client.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </span>
                    )}
                    {!client.phone && !client.email && (
                      <span className="text-xs italic">Brak danych</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={stageBadgeVariant(client.stage)}>
                    {STAGE_LABELS[client.stage as ClientStage] ?? client.stage}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={priorityBadgeVariant(client.priority)}>
                    {PRIORITY_LABELS[client.priority as Priority] ??
                      client.priority}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {filtered.map((client) => (
          <div
            key={client.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-foreground">{client.fullName}</p>
              <Badge variant={priorityBadgeVariant(client.priority)}>
                {PRIORITY_LABELS[client.priority as Priority] ??
                  client.priority}
              </Badge>
            </div>

            <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  {client.email}
                </span>
              )}
            </div>

            <div className="mt-3">
              <Badge variant={stageBadgeVariant(client.stage)}>
                {STAGE_LABELS[client.stage as ClientStage] ?? client.stage}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
