# CLAUDE.md — CRM Doradcy Kredytowego (v3.1)

Instrukcje dla Claude Code (i innych asystentów AI). Obowiązują w każdej sesji bez wyjątku. Jesteś Senior Frontend Developerem i Architektem Systemów. Oczekuję kodu "Production-Ready".

---

## 🛠️ STACK TECHNOLOGICZNY

- **Frontend:** React 19 + Vite + TypeScript (Single Page Application, BEZ SSR).
- **Styling:** Tailwind CSS v4 + shadcn/ui.
- **State Management:** Zustand v5 (global/auth) + TanStack Query (server state).
- **Formularze:** React Hook Form + Zod.
- **Backend:** Firebase v10 Modular SDK (Auth, Firestore, Functions v2, Hosting).
- **PWA:** `vite-plugin-pwa` (strategia: Prompt for update).

---

## 🛑 ŻELAZNE ZASADY WORKFLOW I GIT (Ochrona przed limitami tokenów)

1. **Zasada Mikro-Kroków (Chunking):** Każde zadanie dziel na atomowe etapy (np. Krok 1: UI, Krok 2: Logika, Krok 3: Integracja). **NIGDY nie edytuj więcej niż 3 plików w jednej odpowiedzi.**
2. **Ochrona Kontekstu:** Po wygenerowaniu kodu dla danego mikro-kroku, ZATRZYMAJ SIĘ. Napisz "Gotowe. Czy mam kontynuować do Kroku [X]?" i poczekaj na zgodę użytkownika.
3. **Protokół Zmiany (Zmień -> Zbuduj -> Zapisz):**
   - Po napisaniu kodu BEZWZGLĘDNIE uruchom `npm run build` (weryfikacja błędów TS).
   - Dopiero gdy build przejdzie poprawnie, wykonaj commit.
4. **Konwencja Commitów AI:** Używaj prefiksów: `AI-feat:`, `AI-fix:`, `AI-refactor:`, `AI-chore:`. Opisy po angielsku.
5. **NIGDY `firebase deploy`:** Kod testujemy tylko lokalnie (`npm run dev` / emulator).

---

## 🏛️ ARCHITEKTURA FIREBASE I OFFLINE-FIRST (PRD v3.1)

1. **Inicjalizacja Cache'u (Krytyczne):** - Aplikacja MUSI wspierać tryb Offline.
   - Tryb jest zależny od stanu `deviceMode` (ustalanego w onboardingu).
   - `trusted` -> użyj `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.
   - `shared` -> użyj `memoryLocalCache()`.
2. **Security Rules:** Każde zapytanie i zapis w Firestore musi działać w obrębie `users/{uid}/...`.
3. **Zakaz Firestore TTL:** Nie używaj mechanizmów TTL do rozwiązywania problemów idempotencji.

---

## 📅 INTEGRACJA GOOGLE CALENDAR (Edge Cases)

1. **Deterministyczny Event ID:** Każde wydarzenie tworzone w Kalendarzu MUSI mieć ID w formacie wyprowadzonym z `uid:taskId` (odpowiednio zahashowane/zakodowane w base32hex dla zgodności z API Google).
2. **Mechanizm `syncRevision` (Anti-Loop):**
   - Każda zmiana w tasku wypływająca na kalendarz (tytuł, data) podbija `syncRevision` w Firestore.
   - Cloud Function musi sprawdzić `before.syncStatus !== after.syncStatus` aby nie zapętlić triggera `onWrite`.
3. **Obsługa 7-dniowego Tokena (OAuth Testing Mode):**
   - Jeśli API Google zwróci błąd `invalid_grant` (wygasły refresh token), system MUSI ustawić w Firestore status `reauth_required`.
   - UI (Dashboard) MUSI zareagować na ten status, wyświetlając wyraźny, czerwony banner "Wymagane ponowne połączenie z Kalendarzem (Reconnect)". Nie uciszaj tego błędu!

---

## 📁 STRUKTURA KATALOGÓW (Feature-Based)

Wymuszam trzymanie logiki blisko komponentów. Nie rób wielkich folderów `/components` czy `/hooks` dla całej aplikacji.
Przykładowa struktura:
- `src/features/auth/` (components, store, api)
- `src/features/clients/` (components, hooks, types)
- `src/features/tasks/`
- `src/features/calendar/`
- `src/lib/` (firebase.ts, utils)
- `src/components/ui/` (komponenty bazowe z shadcn)

---

## ✍️ COPYWRITING I UX (Polska Gramatyka i Stany)

1. **Zakaz Skrótów:** Używaj pełnych słów: "miesięcy", "lat", "roku" zamiast "mies.", "r.".
2. **Polska Odmiana:** Dbaj o poprawną deklinację (1 miesiąc, 2 miesiące, 5 miesięcy).
3. **Offline UX:** Główny layout (np. w `App.tsx` lub `Layout.tsx`) musi korzystać z hooka nasłuchującego `navigator.onLine`. Jeśli `false`, wyświetl na samej górze dyskretny żółty pasek: "Brak połączenia. Działasz w trybie offline. Zmiany zostaną zsynchronizowane po odzyskaniu sieci."
4. **Tailwind v4:** Pamiętaj o nowej architekturze (brak `tailwind.config.js` w starym stylu, używaj `@theme` w CSS). Dla bardzo dynamicznych wartości używaj `style={{ color: dynamicHex }}`.