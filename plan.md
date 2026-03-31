# CRM Master Plan — Rozwój aplikacji

> Zaktualizowano: 2026-03-26
> Branch: `feature/faza-2-calendar-ui`
> Firebase: `my-crm-586df` → https://my-crm-586df.web.app

---

## ✅ Zakończone

### Fazy 0–4: Fundamenty, Dashboard, Calendar Sync, Centrum Klienta
- PWA, Auth (Google Sign-In), onboarding, Firestore offline, UI library, AppShell
- Clients, Tasks, Leads, Notes, Documents modules
- Calendar OAuth, 1-way sync, 2-way sync (webhook + incremental), smart formatting (emoji + colorId)
- Client details page (tabs, notes, tasks, documents, edit dialog)
- Lead rejection flow (soft delete z lossReason)

### Faza 5: Lejek Sprzedażowy
- Kanban board z 6 etapami kredytowymi
- Inline editing, notatki, glow UI, historia etapów, CP checkbox
- Modal rozliczenia, tabela archiwum, decyzja negatywna
- Dashboard financial widgets

### Faza 6 (A–G): Cross-module linking, UX, Calendar view
- Kartoteka klienta, Pipeline→Klient linki, Dashboard interaktywny
- Ślad konwersji Lead→Klient
- Globalna wyszukiwarka Ctrl+K
- Filtr miesiąca na widgetach + widget "Ostatnia aktywność"
- Widok kalendarza tygodniowego

### Light Mode (2026-03-25)
- Hook useTheme z localStorage persist + HTML class toggle
- Dual CSS palettes w @theme (dark defaults) + .light overrides
- Shared glass.ts (zastąpił 11 duplikatów GLASS const)
- CSS surface variables (--surface-2..8) dla theme-aware translucent layers
- Toggle w Sidebar (Sun/Moon) + Settings → Ogólne
- Dialog portal fix (createPortal — backdrop-filter stacking context)
- Dialog size prop (sm/default) dla kompaktowych modali
- Kontrast czcionek w light mode (emerald-700, grid-line variables)

### Utwardzenie Google Calendar Sync (2026-03-25)
- Stop starego kanału przy re-rejestracji (bez duplikatów webhooków)
- Cloud Scheduler `renewCalendarWatches` co 6h (auto-renew kanałów < 24h)
- Full re-sync po 410 (zamiast martwej synchronizacji → pełne odzyskanie eventów)
- UI status w Settings (aktywny/wygasa/wygasł + data + przycisk "Odnów kanał")
- Structured logging (`calendar.webhook.*`, `calendar.sync.*`, `calendar.watch.*`, `calendar.oauth.*`)
- Cloud Function `onDealRejected` — soft delete eventów przy odrzuceniu deala

### Mobile Responsive Fixes (2026-03-26)
- AppShell: `min-w-0` na flex content wrapper + `overflow-x-hidden` na `<main>` — naprawia Dashboard i wszystkie strony
- Archiwum wypłat: `whitespace-nowrap` + `overflow-x-auto w-full` na tabelach, sticky `<thead>` z `bg-[var(--surface-4)]`
- RejectedTable: analogiczne poprawki sticky header + scroll
- Dashboard "Dziś do kontaktu": nowy dwurzędowy układ mobile (rząd 1: godzina + klient, rząd 2: typ zadania + akcje pod kciukiem)

---

## ✅ ZROBIONE: "Ukończ i zaplanuj kolejne" + Edycja zadania w kalendarzu (2026-03-31)

## 🟢 NASTĘPNY: 4 drobne usprawnienia UX

> Zaktualizowano: 2026-03-31

### Feature 4: Potwierdzenie przed usunięciem zadania w kalendarzu

**Problem:** W TaskPopup przycisk "Usuń" kasuje zadanie natychmiast bez pytania. Jedno przypadkowe kliknięcie = strata.

**Obecny stan:** `CalendarView.tsx` linia ~342 — `deleteTask.mutate()` wprost w `onClick`, zero confirma.

**Krok 4.1** (1 plik: `CalendarView.tsx`)
- Dodaj `useState<boolean>` dla `confirmDelete`
- Zamień bezpośredni `onClick` na dwuetapowy: pierwszy klik zmienia przycisk na "Na pewno?" (czerwony, pulsujący), drugi klik wykonuje delete
- Auto-reset po 3 sekundach jeśli user nie potwierdzi
- Alternatywa: `window.confirm()` — prostsze, ale mniej eleganckie

---

### Feature 7: Domyślny czas trwania zależny od typu zadania

**Problem:** Telefon trwa ~15 min, spotkanie ~60 min, ale formularz zawsze ustawia 30 min. User musi ręcznie zmieniać za każdym razem.

**Obecny stan:** `CreateTaskDialog.tsx` linia 73 — `durationMin: 30` hardcoded.

**Krok 7.1** (1 plik: `CreateTaskDialog.tsx`)
- Dodaj mapę `TYPE_DEFAULT_DURATION`: `{ call: 15, meeting: 60, followup: 15, docs: 30, check: 15, custom: 30 }`
- Dodaj `useEffect` nasłuchujący `watch("type")` — przy zmianie typu aktualizuj `durationMin` przez `setValue`
- Tylko jeśli user jeszcze nie zmienił ręcznie czasu (śledź flagę `durationTouched`)

---

### Feature 8: Pulsujący badge "nowy" przy świeżych leadach (< 24h)

**Problem:** Nowe leady nie wyróżniają się wizualnie — łatwo przeoczyć świeżego kontakta na liście.

**Obecny stan:** `LeadsPage.tsx` — status "new" wyświetlany jako zwykły Badge `variant="default"`. Brak rozróżnienia świeżych od starych.

**Krok 8.1** (1 plik: `LeadsPage.tsx`)
- Przy leadach ze statusem `"new"` i `createdAt` < 24h dodaj klasę `animate-pulse` na Badge + zmień kolor na `bg-amber-500/20 text-amber-400 border border-amber-500/40`
- Dodaj tekst "NOWY" zamiast standardowej etykiety statusu dla tych < 24h
- Leady new ale > 24h zachowują standardowy badge

---

### Feature 9: Szybka notatka z listy klientów (Quick Note popup)

**Problem:** Żeby dodać notatkę do klienta, trzeba wejść w szczegóły → zakładka Aktywność → textarea. Za dużo kroków na szybką myśl.

**Obecny stan:** Notatki to aktywności typu `NOTE_MANUAL` w kolekcji `users/{uid}/activities`. Hook `useCreateActivity()` już istnieje.

**Krok 9.1** (1 nowy plik: `clients/components/QuickNotePopover.tsx`)
- Mały komponent: ikonka notatki, po kliknięciu — popover z textarea + przycisk "Zapisz"
- Używa istniejącego `useCreateActivity()` z typem `NOTE_MANUAL`
- Props: `clientId`, `clientName`
- Zamknięcie po zapisie + toast "Notatka dodana"

**Krok 9.2** (1 plik: `clients/components/ClientsPage.tsx`)
- Dodaj `<QuickNotePopover />` jako ikonkę w tabeli klientów (kolumna akcji lub obok nazwy)

---

### Kolejność wdrożenia (od najprostszej)

| Krok | Feature | Plik | Opis |
|------|---------|------|------|
| 4.1 | Confirm delete | CalendarView.tsx | Dwuetapowy przycisk "Usuń" → "Na pewno?" |
| 7.1 | Duration per type | CreateTaskDialog.tsx | Mapa domyślnych czasów + useEffect na zmianę typu |
| 8.1 | Pulsujący "NOWY" | LeadsPage.tsx | Badge z animate-pulse dla leadów < 24h |
| 9.1 | Quick Note | QuickNotePopover.tsx (nowy) | Popover z textarea + useCreateActivity |
| 9.2 | Quick Note integracja | ClientsPage.tsx | Ikonka notatki w tabeli klientów |

**5 mikro-kroków, 1 nowy plik, 0 nowych zależności.**

### Feature A: "Ukończ i zaplanuj kolejne"

**Problem:** Po telefonie/spotkaniu doradca prawie zawsze planuje follow-up. Dziś musi: zamknąć zadanie → wrócić → nowe → wpisać klienta. Za dużo kliknięć.

**Gdzie dodajemy przycisk:**
- `CompleteTaskDialog` (lista zadań) — obok "Zakończ"
- `TaskPopup` (kalendarz) — obok "Ukończ"

**Przepływ UX:**
1. Klik "Ukończ i zaplanuj kolejne"
2. Zadanie ukończone (ta sama logika co "Zakończ" + opcjonalna notatka)
3. Otwiera się `CreateTaskDialog` z pre-fill: klient, typ zadania, data = jutro

**Kroki:**

| Krok | Plik | Opis |
|------|------|------|
| A.1 | `TaskActionDialogs.tsx` | Drugi przycisk "Ukończ i zaplanuj kolejne" + callback `onCompleteAndPlanNext` |
| A.2 | Parent (TaskList/TasksPage) | Obsługa callback → otwórz CreateTaskDialog z danymi klienta |
| A.3 | `CreateTaskDialog.tsx` | Nowy prop `defaultType?: TaskType` do pre-fill typu zadania |
| A.4 | `CalendarView.tsx` | Przycisk w TaskPopup + analogiczna logika |

### Feature B: Edycja tytułu i typu zadania w kalendarzu

**Problem:** TaskPopup pozwala edytować godzinę i czas trwania, ale nie tytuł ani typ. Zmiana "Telefon" na "Spotkanie" wymaga wejścia w pełną listę zadań.

**Przepływ UX:**
- Tytuł: klik na tekst → inline input → blur/Enter = zapis
- Typ: mały select obok emoji → zmiana = natychmiastowy zapis
- Ograniczamy do tytułu + typu (pełna edycja zostaje na liście zadań)

**Kroki:**

| Krok | Plik | Opis |
|------|------|------|
| B.1 | `useUpdateTask.ts` | Nowa mutacja `useUpdateTaskDetails` (title + type + syncRevision) |
| B.2 | `CalendarView.tsx` | Inline edit: tytuł → input, typ → select, zapis na blur |

### Pytania do ustalenia przed startem
1. **Domyślna data follow-up:** jutro czy za tydzień? (sugestia: jutro)
2. **Edycja w kalendarzu:** tylko tytuł + typ, czy też opis? (sugestia: tylko tytuł + typ)

---

## 🟡 PLANOWANE: Refaktor fullName → firstName + lastName

> Zaktualizowano: 2026-03-31

### Cel
Rozbić pole `fullName` na `firstName` i `lastName` w całej aplikacji (Firestore, typy, formularze, UI). Zachować wsteczną kompatybilność przez migrację istniejących danych.

### Zakres zmian — 71 wystąpień w 17 plikach

#### Warstwa 1: Schemat danych (Firestore + typy)

| Krok | Plik | Zmiana |
|------|------|--------|
| 1.1 | `features/clients/types/client.ts` | Zod schema: zamień `fullName: z.string()` na `firstName: z.string().min(1).max(60)` + `lastName: z.string().min(1).max(60)`. Dodaj computed getter `fullName` w helper. |
| 1.2 | `features/clients/api/clients.ts` | `ClientDoc` i `ClientDTO`: zamień `fullName: string` na `firstName: string` + `lastName: string`. Dodaj `get fullName()` lub helper `getFullName(c)`. |
| 1.3 | `features/leads/types/lead.ts` | Zod schema: zamień `fullName` na `firstName` + `lastName` |
| 1.4 | `features/leads/api/leads.ts` | `LeadDoc` i `LeadDTO`: zamień `fullName` na `firstName` + `lastName` |
| 1.5 | `components/ui/ClientCombobox.tsx` | `ClientOption`: zamień `fullName` na `firstName` + `lastName`, display = `${firstName} ${lastName}` |

#### Warstwa 2: Firestore operacje CRUD

| Krok | Plik | Zmiana |
|------|------|--------|
| 2.1 | `features/clients/api/clients.ts` | Converter `toFirestore`/`fromFirestore`: czytaj/zapisuj `firstName` + `lastName`. Fallback: jeśli `fullName` istnieje w doc → rozbij na `firstName`/`lastName` (migracja w locie). |
| 2.2 | `features/clients/api/clients.ts` | `checkDuplicate()` — zamień `match.fullName` na `${match.firstName} ${match.lastName}` w wyniku |
| 2.3 | `features/clients/api/clients.ts` | Batch update denormalized `clientName` w deals/tasks: użyj `${firstName} ${lastName}` |
| 2.4 | `features/leads/api/leads.ts` | Converter + `createLead()` + `convertLead()`: analogiczne zmiany jak 2.1 |
| 2.5 | `features/clients/api/useUpdateClient.ts` | Hook: cache invalidation — bez zmian strukturalnych, ale sprawdzić typy |

#### Warstwa 3: Formularze (React Hook Form)

| Krok | Plik | Zmiana |
|------|------|--------|
| 3.1 | `features/clients/components/CreateClientDialog.tsx` | Zamień 1 pole "Imię i nazwisko" na 2 pola: "Imię" + "Nazwisko". `register("firstName")`, `register("lastName")`. Layout: 2 kolumny w jednym wierszu. |
| 3.2 | `features/clients/components/EditClientDialog.tsx` | Analogicznie — 2 pola, defaultValues z `client.firstName` / `client.lastName` |
| 3.3 | `features/leads/components/CreateLeadDialog.tsx` | Zamień "Imię i nazwisko" na "Imię" + "Nazwisko" |
| 3.4 | `features/leads/components/LeadsPage.tsx` | Quick-add form: zamień 1 input na 2 (`firstName`, `lastName`). Na mobile: pełna szerokość każde. Na desktop: 2 kolumny. |

#### Warstwa 4: Wyszukiwanie i filtrowanie

| Krok | Plik | Zmiana |
|------|------|--------|
| 4.1 | `features/clients/components/ClientList.tsx` | Filtrowanie: `c.firstName.toLowerCase().includes(q) \|\| c.lastName.toLowerCase().includes(q)` |
| 4.2 | `features/clients/components/ClientsPage.tsx` | CSV export: zamień kolumnę "Imię i nazwisko" na "Imię" + "Nazwisko" (2 kolumny) |
| 4.3 | `components/CommandPalette.tsx` | Search: match against `firstName` + `lastName`, display `${firstName} ${lastName}` |
| 4.4 | `components/layout/GlobalSearch.tsx` | Analogicznie — search + display |
| 4.5 | `components/ui/ClientCombobox.tsx` | Filter + display: `${firstName} ${lastName}` |

#### Warstwa 5: Wyświetlanie w UI

| Krok | Plik | Zmiana |
|------|------|--------|
| 5.1 | `features/clients/components/ClientList.tsx` | Tabela desktop + karty mobile: `{client.firstName} {client.lastName}` |
| 5.2 | `features/clients/components/ClientDetailsPage.tsx` | Nagłówek, inicjały (użyj `firstName[0] + lastName[0]`), przekazanie do child komponentów |
| 5.3 | `features/leads/components/LeadsPage.tsx` | Tabela + karty + dialogi (ConvertDialog, RejectDialog): `{lead.firstName} {lead.lastName}` |
| 5.4 | `features/leads/components/CreateLeadDialog.tsx` | Duplicate warning: display `${match.firstName} ${match.lastName}` |
| 5.5 | `features/dashboard/components/DashboardPage.tsx` | Sekcja "Nowe leady": `{lead.firstName} {lead.lastName}` |
| 5.6 | `features/deals/components/PipelinePage.tsx` | Denormalized `clientName` — bez zmian (pipeline czyta string z deal, nie z client) |

#### Warstwa 6: Helper i migracja

| Krok | Plik | Zmiana |
|------|------|--------|
| 6.1 | `lib/format.ts` (nowy export) | `splitFullName(fullName: string): { firstName: string; lastName: string }` — dzieli po ostatniej spacji (np. "Jan Maria Kowalski" → firstName: "Jan Maria", lastName: "Kowalski"). Fallback: jeśli brak spacji, firstName = fullName, lastName = "". |
| 6.2 | Firestore convertery | W `fromFirestore`: jeśli doc ma `fullName` a nie ma `firstName` → użyj `splitFullName()` do migracji w locie. Przy pierwszym zapisie `updateDoc` → zapisz już rozbite pola. |
| 6.3 | (opcjonalnie) Cloud Function | Jednorazowy skrypt migracyjny: iteruj po `users/{uid}/clients` i `users/{uid}/leads`, rozbij `fullName` na `firstName`+`lastName`, zapisz. Usuń pole `fullName` po migracji. |

### Strategia migracji (zero downtime)

1. **Faza A — Dual-write:** Nowy kod zapisuje `firstName` + `lastName` + `fullName` (computed). Stary frontend nie jest uszkodzony.
2. **Faza B — Dual-read:** Converter czyta `firstName`/`lastName` jeśli istnieją, fallback na `splitFullName(fullName)`.
3. **Faza C — Cleanup:** Po potwierdzeniu, że wszystkie dokumenty mają nowe pola → usuń `fullName` z zapisu.

### Helper `splitFullName()`

```typescript
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, lastSpace),
    lastName: trimmed.slice(lastSpace + 1),
  };
}
```

### Kolejność wdrożenia (mikro-kroki)

| Sprint | Kroki | Pliki | Opis |
|--------|-------|-------|------|
| S1 | 6.1, 1.1, 1.2, 1.3, 1.4 | 5 | Helper + typy + interfaces (fundament) |
| S2 | 2.1, 2.2, 2.3, 2.4 | 2 | Firestore CRUD z dual-read/dual-write |
| S3 | 3.1, 3.2 | 2 | Formularze klientów (2 pola) |
| S4 | 3.3, 3.4 | 2 | Formularze leadów (2 pola) |
| S5 | 4.1, 4.2, 4.3, 4.4, 4.5 | 5 | Wyszukiwanie + filtrowanie + CSV |
| S6 | 5.1, 5.2, 5.3, 5.4, 5.5 | 5 | UI display (tabele, karty, nagłówki) |
| S7 | 1.5, 2.5 | 2 | ClientCombobox + useUpdateClient |
| S8 | 6.2, 6.3 | 2 | Migracja w locie + opcjonalny skrypt |

**8 sprintów, max 3 pliki na krok, ~23 mikro-kroków, 0 nowych zależności.**

### Ryzyka

| Ryzyko | Mitygacja |
|--------|-----------|
| Istniejące dane mają tylko `fullName` | Dual-read + `splitFullName()` fallback |
| Polskie nazwiska złożone (np. "Kowalski-Nowak") | `lastIndexOf(" ")` traktuje poprawnie — bierze ostatni segment |
| Denormalized `clientName` w deals/tasks | Pozostaje jako string `"Jan Kowalski"` — bez zmian struktury |
| Cloud Functions mogą czytać `fullName` | Sprawdzić `functions/src/` — brak bezpośrednich odwołań do fullName (dane przechodzą przez triggery) |

---

## 🔵 PÓŹNIEJ: Powiadomienia push PWA (6H)

### Prerequisite (ręczny krok)
- [ ] Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Wygenerować klucz VAPID
- [ ] GCP Console → APIs → Cloud Tasks API → Enable
- [ ] Utworzyć kolejkę: `gcloud tasks queues create task-reminders --location=europe-west1`

### Kroki
- **H1:** FCM config + messaging singleton (`app/src/lib/messaging.ts`)
- **H2:** Service Worker dla background push (`app/public/firebase-messaging-sw.js`)
- **H3:** API notyfikacji — `requestPermission()`, zapis FCM token do Firestore
- **H4:** NotificationsTab UI w Settings (status, toggle, czas przypomnienia, test button)
- **H5:** Foreground notification handler (in-app toast)
- **H6:** Cloud Function scheduler — Cloud Tasks scheduling helper
- **H7:** HTTP endpoint `sendTaskReminder` — odczyt taska, wysyłka push
- **H8:** Firestore trigger `onTaskWrite` — auto-schedule/cancel Cloud Tasks
- **H9:** Token refresh + multi-device support
- **H10:** Ikony powiadomień Android (ic_notification w różnych dpi)
- **H11:** Test end-to-end + notification click → otwiera właściwy widok

---

## 🔵 NA KOŃCU: Import archiwum

- Wrzucenie historycznych spraw archiwalnych do Firestore
- Dane od usera (CSV/ręczny import)

---

## ⏸️ Odłożone (brak potrzeby na teraz)

### 2FA (TOTP / Google Authenticator)
- Google Sign-In + 2FA na koncie Google już chroni apkę — overengineering

### Powiadomienia SMS dla klientów
- Integracja z SMSAPI.pl — "nice to have", nie "must have"
- Ewentualnie w przyszłości: przypomnienie o spotkaniu 24h przed

---

## Tech debt
- Merge brancha `feature/faza-2-calendar-ui` do `main`
- Code-splitting (chunk > 500kB)

---

## Ryzyka

| Ryzyko | Mitygacja |
|--------|-----------|
| Cloud Scheduler wymaga Blaze | Już na Blaze |
| 7-dniowy refresh token (OAuth testing) | Auto-renew co 6h + banner "Reconnect" |
| PWA SW konflikt z FCM SW | Osobne pliki: PWA SW z vite-plugin-pwa, FCM SW ręczny |
| iOS Safari ograniczenia push | Działa od iOS 16.4+ po "Dodaj do ekranu głównego" |
