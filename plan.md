# CRM Master Plan — Rozwój aplikacji

> Zaktualizowano: 2026-03-25
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

---

## 🟢 NASTĘPNY: Utwardzenie Google Calendar Sync

Szczegóły: `plan-calendar-hardening.md`

### Prerequisite (ręczny krok)
- [ ] GCP Console → APIs → Cloud Scheduler API → Enable

### Kroki
1. **Stop starego kanału** przy re-rejestracji — zapobiega duplikatom
2. **Cloud Scheduler co 6h** — auto-renew kanałów wygasających w ciągu 24h
3. **Full re-sync po 410** — zamiast "wyczyść i czekaj" → pełne odzyskanie
4. **UI status** — banner na dashboardzie + info o wygaśnięciu w Settings
5. **Structured logging** — etykiety `calendar.watch.*` / `calendar.sync.*`

---

## 🟠 POTEM: Powiadomienia push PWA (6H)

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
