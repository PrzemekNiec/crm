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

## ✅ Drobne usprawnienia UX (2026-03-31)
- Feature 4: Potwierdzenie przed usunięciem zadania w kalendarzu (dwuetapowy przycisk)
- Feature 7: Domyślny czas trwania zależny od typu zadania
- Feature 8: Pulsujący badge "NOWY" dla leadów < 24h
- Feature 9: Szybka notatka z listy klientów (QuickNotePopover)
- Feature A: "Ukończ i zaplanuj kolejne" (TaskPopup + TaskActionDialogs)
- Feature B: Edycja tytułu i typu zadania w kalendarzu (inline edit)

---

## ✅ Refaktor fullName → firstName + lastName (2026-03-31)
- Dual-write (firstName + lastName + computed fullName) + dual-read z fallback
- Wszystkie formularze, wyszukiwarki, listy, CSV export zaktualizowane
- splitFullName(): cały stary fullName → lastName, firstName="" (do ręcznego uzupełnienia)
- Sortowanie klientów po lastName (Polish locale)

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
