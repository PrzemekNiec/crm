import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "../api/useClients";
import { Badge } from "@/components/ui/Badge";
import {
  STAGE_LABELS,
  PRIORITY_LABELS,
  type ClientStage,
  type Priority,
} from "../types/client";
import type { ClientDTO } from "../api/clients";
import { Users, Phone, Mail, Handshake } from "lucide-react";
import { GLASS } from "@/lib/glass";
import { formatPhoneNumber } from "@/lib/format";
import { QuickNotePopover } from "./QuickNotePopover";

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
    <div className="flex items-center gap-4 rounded-md p-4 animate-pulse bg-[var(--surface-4)]">
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
  const navigate = useNavigate();
  const { data: clients, isLoading, isError } = useClients();

  const filtered = useMemo(() => {
    if (!clients) return [];
    let result = [...clients];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c: ClientDTO) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => a.lastName.localeCompare(b.lastName, "pl"));
    return result;
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
      <div className="rounded-xl border border-destructive/30 bg-[var(--surface-4)] backdrop-blur-xl p-8 text-center">
        <p className="text-sm text-destructive">
          Nie udało się pobrać listy klientów. Spróbuj odświeżyć stronę.
        </p>
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────────
  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-12 text-center">
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
      <div className="rounded-xl border border-[var(--surface-8)] bg-[var(--surface-4)] backdrop-blur-xl p-8 text-center">
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
      <div
        className="hidden overflow-x-auto rounded-xl md:block"
        style={GLASS}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-6)] text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Imię i nazwisko</th>
              <th className="px-4 py-3">Kontakt</th>
              <th className="px-4 py-3">Źródło</th>
              <th className="px-4 py-3">Etap</th>
              <th className="px-4 py-3">Priorytet</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-6)]">
            {filtered.map((client) => (
              <tr
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="transition-colors hover:bg-[var(--surface-5)] cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {client.firstName} {client.lastName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5 text-muted-foreground">
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {formatPhoneNumber(client.phone)}
                      </a>
                    )}
                    {client.email && (
                      <a
                        href={`mailto:${client.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </a>
                    )}
                    {!client.phone && !client.email && (
                      <span className="text-xs italic">Brak danych</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {client.source === "referral" ? (
                    <span className="flex items-center gap-1.5 text-xs text-primary">
                      <Handshake className="h-3.5 w-3.5" />
                      <span>
                        {client.referralName || "Pośrednik"}
                        {client.referralRate != null && (
                          <span className="ml-1 text-primary/70">
                            &bull; {client.referralRate}%
                          </span>
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Własny</span>
                  )}
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
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <QuickNotePopover clientId={client.id} clientName={`${client.firstName} ${client.lastName}`} />
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
            onClick={() => navigate(`/clients/${client.id}`)}
            className="rounded-xl p-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
            style={GLASS}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{client.firstName} {client.lastName}</p>
                <div onClick={(e) => e.stopPropagation()}>
                  <QuickNotePopover clientId={client.id} clientName={`${client.firstName} ${client.lastName}`} />
                </div>
              </div>
              <Badge variant={priorityBadgeVariant(client.priority)}>
                {PRIORITY_LABELS[client.priority as Priority] ??
                  client.priority}
              </Badge>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
              {client.phone ? (
                <a
                  href={`tel:${client.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 py-1 hover:text-primary active:text-primary transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {client.phone}
                </a>
              ) : (
                <span />
              )}
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 py-1 hover:text-primary active:text-primary transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[180px]">{client.email}</span>
                </a>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge variant={stageBadgeVariant(client.stage)}>
                {STAGE_LABELS[client.stage as ClientStage] ?? client.stage}
              </Badge>
              {client.source === "referral" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Handshake className="h-3 w-3" />
                  {client.referralName || "Pośrednik"}
                  {client.referralRate != null && (
                    <span className="text-primary/70">
                      &bull; {client.referralRate}%
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
