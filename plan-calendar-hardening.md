# Plan: Utwardzenie Google Calendar Sync

> Data: 2026-03-25
> Branch: `feature/faza-2-calendar-ui`

---

## Diagnoza — co jest dzisiaj zepsute?

### Problem 1: Kanał webhook umiera po cichu
- Google Calendar watch channel wygasa (max 7 dni w OAuth testing mode, ~30 dni w production).
- Po wygaśnięciu: **zero powiadomień push** → synchronizacja Google→CRM przestaje działać.
- **Brak auto-renew.** Jedyny sposób to ręczne kliknięcie "Włącz synchronizację" w Ustawieniach.
- User nie wie, że sync nie działa, dopóki nie zauważy rozbieżności.

### Problem 2: syncToken 410 = martwa synchronizacja
- Gdy Google zwraca 410 (syncToken expired), webhook czyści `syncToken` i **kończy**.
- Nie wykonuje full re-sync → kanał dalej istnieje, ale sync jest złamany.
- Kolejne webhooki będą failować z `!syncToken`.

### Problem 3: Brak monitoringu
- Brak informacji w UI o stanie zdrowia synchronizacji.
- `watchExpiration` jest w Firestore, ale nigdzie nie jest pokazywany ani sprawdzany.

### Problem 4: Stare kanały nie są sprzątane
- Każde kliknięcie "Włącz synchronizację" tworzy nowy kanał.
- Stare kanały dalej wysyłają webhooki → duplikaty, niepotrzebny ruch.

---

## Plan naprawczy (5 kroków)

### Krok 1: Cloud Scheduler — auto-renew kanału (functions)
**Nowa Cloud Function:** `renewCalendarWatches` (onSchedule, co 6h)

Logika:
1. Skanuj wszystkich userów z aktywną integracją (`oauthStatus: "active"` + `calendar.watchChannelId != null`)
2. Dla każdego: sprawdź `calendar.watchExpiration`
3. Jeśli wygasa w ciągu **24h** (lub już wygasł):
   a. Stop stary kanał (Google Calendar API `channels.stop`)
   b. Usuń stary doc z `calendarWatchChannels/{oldChannelId}`
   c. Uzyskaj nowy `syncToken` (full event list pagination)
   d. Zarejestruj nowy kanał (`events.watch`)
   e. Zapisz nowe `watchChannelId`, `watchResourceId`, `syncToken`, `watchExpiration`
   f. Utwórz nowy doc `calendarWatchChannels/{newChannelId}`
4. Jeśli token refresh fail → ustaw `reauth_required`, pomiń usera

**Pliki:**
- `functions/src/index.ts` — nowa exported function
- Wymaga: `firebase-functions/v2/scheduler` → `onSchedule`

**Prerequisite (ręczny krok):**
- GCP Console → APIs → Cloud Scheduler API → **Enable**

---

### Krok 2: Full re-sync po 410 (functions)
**Modyfikacja:** `googleCalendarWebhook`

Obecne zachowanie po 410:
```
clearSyncToken → return OK → nic
```

Nowe zachowanie:
```
clearSyncToken → full re-sync:
  1. Pobierz wszystkie eventy (pagination) → nowy syncToken
  2. Zapisz nowy syncToken
  3. Przetworz CRM eventy z pełnej listy (jak normalny webhook)
```

**Pliki:**
- `functions/src/index.ts` — modyfikacja istniejącej funkcji `googleCalendarWebhook`
- Wyciągnięcie logiki "process CRM events" do reużywalnej funkcji pomocniczej

---

### Krok 3: Stop starego kanału przy re-rejestracji (functions)
**Modyfikacja:** `registerCalendarWatch`

Przed rejestracją nowego kanału:
1. Odczytaj istniejący `calendar.watchChannelId` i `calendar.watchResourceId`
2. Jeśli istnieje → wywołaj Google Calendar API `channels.stop` (DELETE)
3. Usuń stary doc z `calendarWatchChannels/{oldChannelId}`
4. Dopiero potem rejestruj nowy kanał

Dzięki temu:
- Nie kumulują się martwe kanały
- Nie ma duplikatów webhooków

**Pliki:**
- `functions/src/index.ts` — modyfikacja istniejącej funkcji

---

### Krok 4: Status sync w UI (frontend)
**Modyfikacja:** `SettingsPage.tsx` → zakładka Integracje

Wyświetl:
- Status kanału: "Aktywny" (zielony) / "Wygasa wkrótce" (żółty) / "Wygasł" (czerwony)
- Data wygaśnięcia: "Ważny do: 28.03.2026 14:30"
- Przycisk "Odśwież kanał" (ręczny re-register)

**Modyfikacja:** `DashboardPage.tsx`

Nowy banner (obok istniejącego reauth banner):
- Jeśli `watchExpiration < now` → żółty banner: "Synchronizacja kalendarza wygasła. Kliknij aby odnowić."

**Pliki:**
- `app/src/features/settings/components/SettingsPage.tsx`
- `app/src/features/dashboard/components/DashboardPage.tsx`

---

### Krok 5: Structured logging + alerty (functions)
**Modyfikacja:** Wszystkie funkcje calendar

Ujednolicenie logowania:
```typescript
logger.info("calendar.watch.renewed", { uid, channelId, expiresAt });
logger.warn("calendar.watch.expiring", { uid, hoursLeft });
logger.error("calendar.watch.renewFailed", { uid, error });
logger.info("calendar.sync.fullResync", { uid, eventsCount });
```

Dzięki temu w Firebase Console → Logs:
- Filtr `calendar.watch` → pełny obraz stanu kanałów
- Alerty na `error` severity (opcjonalnie: GCP Alerting)

**Pliki:**
- `functions/src/index.ts`

---

## Kolejność implementacji

| Krok | Priorytet | Pliki | Opis |
|------|-----------|-------|------|
| 3 | Krytyczny | functions/src/index.ts | Stop starego kanału — zapobiega duplikatom |
| 1 | Krytyczny | functions/src/index.ts | Auto-renew co 6h — główny fix |
| 2 | Wysoki | functions/src/index.ts | Full re-sync po 410 — naprawia zepsuty stan |
| 4 | Średni | SettingsPage + Dashboard | UI status — user wie co się dzieje |
| 5 | Niski | functions/src/index.ts | Logi — debugging i monitoring |

---

## Ryzyka

| Ryzyko | Mitygacja |
|--------|-----------|
| Cloud Scheduler wymaga planu Blaze | Już jesteśmy na Blaze (wymagane przez Cloud Functions) |
| `channels.stop` fail (404) | Tolerujemy — kanał już nie istnieje, OK |
| Full re-sync obciąża API | Pagination z maxResults=250, jednorazowy koszt |
| Race condition: scheduler + manual re-register | Scheduler sprawdza `watchExpiration` — jeśli kanał świeży, pomija |
| OAuth testing mode (7 dni) | Auto-renew co 6h rozwiązuje to. Docelowo: production OAuth |

---

## Weryfikacja

1. `cd functions && npm run build` po każdym kroku
2. `npm run build` (frontend) po kroku 4
3. Test: zarejestruj kanał → czekaj → sprawdź w logach czy scheduler odnawiał
4. Test: ręcznie ustaw `watchExpiration` na przeszłość → scheduler powinien odnowić
5. Test: ręcznie wyczyść `syncToken` → webhook powinien zrobić full re-sync
