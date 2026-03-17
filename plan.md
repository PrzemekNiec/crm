# Plan rozwoju CRM — Faza 6: Linkowanie modułów i UX

> Wygenerowano: 2026-03-17
> Branch: `feature/faza-2-calendar-ui`
> Cel: Połączyć istniejące moduły w spójny ekosystem, wyeliminować "martwe zakończenia" w nawigacji.

---

## Etap A: Kartoteka klienta — pełna interakcja (Priorytet: krytyczny)

### A1. Akcje na zadaniach w zakładce klienta ✅
- [x] Dodać przyciski (ukończ / przełóż / usuń) do kart zadań w `ClientDetailsPage.tsx` → `TasksTab`
- [x] Reuse logiki z `TaskList.tsx` (eksport `TaskActions` + `RescheduleDialog`)
- [x] Obsługa statusu `system_cancelled` — badge "Anulowane (system)" bez akcji

### A2. Przycisk "Dodaj zadanie" z kontekstu klienta ✅
- [x] Przycisk "+" w nagłówku zakładki Zadania
- [x] Otwiera `CreateTaskDialog` z prefillowanym `clientId` i `clientName`
- [x] Po sukcesie → invalidacja `tasksQueryKey`

### A3. Przycisk "Dodaj szansę" z kontekstu klienta ✅
- [x] Przycisk "+" w nagłówku zakładki Szanse
- [x] Inline `CreateDealDialog` z prefillowanym `clientId` i `clientName`
- [x] Po sukcesie → invalidacja `dealsQueryKey`

### A4. Klikalne deale w zakładce klienta ✅ (nawigacja do /pipeline)
- [x] Klik na kartę → nawiguje do `/pipeline`
- [x] Badge statusu (Odrzucony / Zarchiwizowany)
- [ ] [Opcjonalnie later] Wyodrębnić `DealDetailModal` i otwierać in-place

---

## Etap B: Pipeline → Kartoteka klienta (Priorytet: wysoki)

### B1. Klikalny `clientName` na karcie deala ✅
- [x] W `DealCard`: `clientName` jako `<a>` → `/clients/{clientId}`
- [x] Styl: underline on hover, `text-blue-400`
- [x] `e.stopPropagation()` żeby klik na link nie otwierał modalu deala
- [x] Klikalny `clientName` w tabeli archiwum i tabeli odrzuconych

### B2. Klikalny `clientName` w modalu deala ✅
- [x] Nazwa klienta jako link do kartoteki

---

## Etap C: Dashboard — interaktywne widgety (Priorytet: wysoki)

### C1. Akcje na kartach zaległych zadań ✅
- [x] Przyciski (ukończ / przełóż / usuń) w sekcji "Zaległe zadania"
- [x] Link do klienta na kartach zaległych

### C2. Akcje na kartach timeline (dziś) ✅
- [x] Istniejące akcje (Complete/Reschedule/Delete) już działały
- [x] Dodano link do klienta przy nazwie klienta na karcie

### C3. Klikalne karty nowych leadów ✅
- [x] Klik na kartę leada → nawigacja do `/leads`

### C4. Klikalne widgety statystyk ✅
- [x] Widgety finansowe → klik → `/pipeline`
- [x] "Dziś do kontaktu" → klik → `/tasks`
- [x] "Zaległe" → klik → `/tasks`
- [x] "Nowe leady" → klik → `/leads`

---

## Etap D: Ślad konwersji Lead → Klient (Priorytet: średni)

### D1. Zapisywanie źródła konwersji
- [ ] W `convertLead()` → zapisać `convertedFromLeadId` i `convertedAt` w dokumencie klienta
- [ ] Zaktualizować typ `ClientDTO` o opcjonalne pole `convertedFromLeadId`

### D2. Badge w kartotece klienta
- [ ] W nagłówku `ClientDetailsPage`: jeśli `convertedFromLeadId` → badge "Skonwertowany z leada"
- [ ] Opcjonalnie: tooltip z datą konwersji

---

## Etap E: Globalna wyszukiwarka Ctrl+K (Priorytet: średni)

### E1. Komponent `CommandPalette`
- [ ] Nowy plik `components/CommandPalette.tsx`
- [ ] Dialog otwierany przez Ctrl+K (lub Cmd+K na Mac)
- [ ] Input z autofocus + lista wyników

### E2. Wyszukiwanie po modułach
- [ ] Przeszukiwanie klientów (fullName, phone, email)
- [ ] Przeszukiwanie dealów (title, clientName)
- [ ] Przeszukiwanie zadań (title)
- [ ] Wyniki pogrupowane sekcjami: Klienci / Szanse / Zadania

### E3. Nawigacja z wyników
- [ ] Klik na klienta → `/clients/{id}`
- [ ] Klik na deal → `/pipeline` (+ otwórz modal)
- [ ] Klik na task → `/tasks` (+ highlight)
- [ ] Zamknięcie palety po wyborze

---

## Etap F: Dashboard — filtrowanie i historia (Priorytet: średni)

### F1. Filtr miesiąca/roku na widgetach finansowych
- [ ] Dropdown miesiąc/rok nad widgetami finansowymi
- [ ] Filtrowanie dealów po `payoutDate` (zamknięte) i `createdAt` (aktywne)
- [ ] Domyślnie: bieżący miesiąc

### F2. Sekcja "Ostatnia aktywność"
- [ ] Nowy widget na dashboardzie: log ostatnich akcji
- [ ] Źródło danych: ostatnio zmienione dokumenty (deals, tasks, notes) po `updatedAt`
- [ ] Wyświetlanie: "Dodano notatkę do [klient]", "Zmieniono etap [deal]", "Ukończono [task]"
- [ ] Limit: 10 ostatnich wpisów

---

## Etap G: Widok kalendarza w CRM (Priorytet: niski — duży zakres)

### G1. Komponent `CalendarView`
- [ ] Nowy feature folder: `features/calendar/components/CalendarView.tsx`
- [ ] Widok tygodniowy z siatką godzinową (6:00–21:00)
- [ ] Wyświetlanie zadań z `dueDate` jako bloki na siatce
- [ ] Kolor bloku = typ zadania (emoji mapping → kolor)

### G2. Nawigacja tygodniowa
- [ ] Strzałki ← → do zmiany tygodnia
- [ ] Przycisk "Dziś" do powrotu do bieżącego tygodnia
- [ ] Header z datami (pon–niedz)

### G3. Interakcja z zadaniami
- [ ] Klik na blok → mini-popup z detalami zadania + akcje (ukończ/przełóż)
- [ ] Opcjonalnie: drag & drop do zmiany godziny (reschedule)

---

## Etap H: Powiadomienia push PWA (Priorytet: niski — wymaga FCM)

### H1. Rejestracja FCM token
- [ ] Service Worker: obsługa `push` event
- [ ] Po zalogowaniu: request permission + zapisz token w Firestore

### H2. Cloud Function: scheduler
- [ ] Scheduled function (co 15 min): query tasków z `dueDate` w ciągu 30 min
- [ ] Wyślij push notification z tytułem zadania

### H3. UI: zarządzanie notyfikacjami
- [ ] W Settings: toggle "Powiadomienia push"
- [ ] Stan: włączone/wyłączone/brak zgody przeglądarki

---

## Legenda statusów

| Symbol | Status |
|--------|--------|
| [ ] | Do zrobienia |
| [~] | W trakcie |
| [x] | Gotowe |
| [-] | Pominięte |

---

## Kolejność realizacji

```
A1 → A2 → A3 → A4 → B1 → B2 → C1 → C2 → C3 → C4 → D1 → D2 → E1 → E2 → E3 → F1 → F2 → G1 → G2 → G3 → H1 → H2 → H3
```

Etapy A–C to quick wins (małe zmiany, duży efekt UX).
Etapy D–F to średni nakład.
Etapy G–H to duże feature'y na osobne sesje.
