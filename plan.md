# CRM Master Plan — Implementacja Faz 1–3

> Wygenerowano: 2026-03-19
> Branch: `feature/faza-2-calendar-ui`
> Cel: Light Mode (Faza 1), TOTP 2FA (Faza 2), Push Notifications z Cloud Tasks (Faza 3)

**Stan kodu:** 16 plików z hardcoded kolorami (~250 instancji), brak theme store, brak MFA, FCM library zainstalowana ale nieużywana, 6 Cloud Functions (calendar sync).

---

## FAZA 1: Light Mode (~20 mikro-kroków)

### Architektura CSS (Tailwind v4)
Obecny `@theme` block w `index.css` ma wartości dark-only. Strategia:
- `:root` = paleta jasna (default)
- `.dark` = paleta ciemna (obecne wartości)
- `@custom-variant dark (&:where(.dark, .dark *))` dla Tailwind
- `@theme` wskazuje na CSS custom properties (`--color-background: var(--bg)`)
- `@utility glass` / `@utility glass-card` zamiast inline GLASS obiektów

### Krok 1.1: Theme store + persistence [ ]
- **CREATE** `app/src/store/useThemeStore.ts` — Zustand store: `theme: 'light'|'dark'|'system'`, `resolvedTheme`, `setTheme()`, `initTheme()`. Persystencja w `localStorage('crm:theme')`. Nasłuchuje `matchMedia('prefers-color-scheme: dark')`. Ustawia `.dark` na `<html>` i aktualizuje `<meta name="theme-color">`.
- `npm run build`

### Krok 1.2: Restrukturyzacja CSS variables [ ]
- **MODIFY** `app/src/index.css` — Rozbicie `@theme` na `:root` (jasne) + `.dark` (ciemne). Dodanie `@custom-variant dark`. Dodanie `@utility glass` i `@utility glass-card` z CSS variables per motyw. Fix body gradient (jasny vs ciemny). Fix hardcoded `select option` i `[role="option"]`.
- `npm run build` + wizualny check (dark mode wygląda tak samo jak przed zmianą)

### Krok 1.3: Anti-FOUC + index.html [ ]
- **MODIFY** `app/index.html` — Inline script w `<head>` czytający `localStorage('crm:theme')` i ustawiający `.dark` PRZED CSS. Usunięcie hardcoded `class="dark"` i `style="color-scheme: dark"`.
- **MODIFY** `app/vite.config.ts` — Neutralne `theme_color`/`background_color` w manifeście PWA.
- Brak flashu białego tła

### Krok 1.4: Theme toggle w Settings — zakładka "Wygląd" [ ]
- **MODIFY** `app/src/features/settings/components/SettingsPage.tsx` — Nowa zakładka `"appearance"` z ikoną `Palette`. Komponent `AppearanceTab`: 3 opcje (Jasny/Ciemny/Systemowy) jako karty z ikonami. Zamiana inline GLASS na `className="glass"`.
- Przełącznik działa, persystuje po reload

### Krok 1.5: Refaktor layout (Sidebar + AppShell) [ ]
- **MODIFY** `app/src/components/layout/Sidebar.tsx` — `bg-white/[0.04]` → `glass` utility lub `bg-card/80 dark:bg-white/[0.04]`. Analogicznie `border-white/[0.06]`.
- **MODIFY** `app/src/components/layout/AppShell.tsx` — To samo dla MobileTopbar, MobileBottomNav. Zamiana `bg-white/[0.02]`, `border-white/[0.06]`.
- Layout poprawny w obu motywach

### Krok 1.6: Refaktor komponentów bazowych (shadcn) [ ]
- **MODIFY** `app/src/components/ui/Select.tsx` — `bg-[#1e2329]` → `bg-popover`, `text-[#f0f4f8]` → `text-popover-foreground`
- **MODIFY** `app/src/components/ui/Dialog.tsx` — Weryfikacja `bg-black/60` (overlay OK dla obu motywów)
- **MODIFY** `app/src/components/CommandPalette.tsx` — Fix hardcoded kolorów
- Select, Dialog, CommandPalette w obu motywach

### Krok 1.7: DashboardPage [ ]
- **MODIFY** `app/src/features/dashboard/components/DashboardPage.tsx` — Zamiana ~15 instancji `bg-white/[0.04]`, `border-white/[0.08]` na `bg-card`, `border-border` lub `glass`.
- Dashboard w obu motywach

### Krok 1.8: ClientList [ ]
- **MODIFY** `app/src/features/clients/components/ClientList.tsx` — Usunięcie inline GLASS rgba, zamiana na `glass` utility. Fix `bg-white/[...]` patterns.
- Lista klientów w obu motywach

### Krok 1.9: ClientDetailsPage (część 1) [ ]
- **MODIFY** `app/src/features/clients/components/ClientDetailsPage.tsx` — Usunięcie GLASS constant, zamiana na utility. Pierwsza połowa pliku (inline rgba).
- Build przechodzi

### Krok 1.10: ClientDetailsPage (część 2) + EditClientDialog [ ]
- **MODIFY** `app/src/features/clients/components/ClientDetailsPage.tsx` — Reszta `bg-white/[...]`
- **MODIFY** `app/src/features/clients/components/EditClientDialog.tsx` — Fix `bg-white/[0.06]`, `border-white/[0.08]`
- Szczegóły klienta + dialog edycji w obu motywach

### Krok 1.11: PipelinePage (część 1) [ ]
- **MODIFY** `app/src/features/deals/components/PipelinePage.tsx` — Usunięcie GLASS/GLASS_CARD constants → `glass`/`glass-card` utility. Pierwsza połowa inline rgba.
- Build przechodzi

### Krok 1.12: PipelinePage (część 2) [ ]
- **MODIFY** `app/src/features/deals/components/PipelinePage.tsx` — Reszta `bg-white/[...]`, inline rgba, `bg-white/10` na inputach.
- Pipeline/Kanban w obu motywach

### Krok 1.13: LeadsPage [ ]
- **MODIFY** `app/src/features/leads/components/LeadsPage.tsx` — Usunięcie GLASS constant. Fix `border-white/[0.12]`, `bg-white/[0.04]`, `bg-white/[0.08]`, textarea `bg-white/[0.06]`.
- Leady w obu motywach

### Krok 1.14: TasksPage + TaskList [ ]
- **MODIFY** `app/src/features/tasks/components/TasksPage.tsx` — Inline rgba → `glass`
- **MODIFY** `app/src/features/tasks/components/TaskList.tsx` — Inline rgba → utility/semantic
- Zadania w obu motywach

### Krok 1.15: CalendarView [ ]
- **MODIFY** `app/src/features/calendar/components/CalendarView.tsx` — TYPE_COLORS: dodanie `dark:` prefixów (`text-blue-700 dark:text-blue-300`). Bg/border opacity classes działają w obu.
- Kalendarz czytelny w obu motywach

### Krok 1.16: LoginPage + CommandPalette + AuthGuard [ ]
- **VERIFY** `app/src/features/auth/components/LoginPage.tsx` — Używa semantic classes, drobne poprawki jeśli potrzebne
- **VERIFY** `app/src/components/AuthGuard.tsx` — Check hardcoded colors
- Login i auth flow w obu motywach

### Krok 1.17: OnboardingWizard [ ]
- **VERIFY/MODIFY** `app/src/features/auth/components/OnboardingWizard.tsx` — Sprawdzenie i fix hardcoded kolorów
- Onboarding w obu motywach

### Krok 1.18: Finalny CSS cleanup [ ]
- **MODIFY** `app/src/index.css` — Sprawdzenie animacji (`pulse-border` keyframes → `var(--color-destructive)`). Cleanup pozostałych hardcoded wartości.
- Pełny visual QA: Light + Dark

---

## FAZA 2: TOTP 2FA (~10 mikro-kroków)

### Prerequisite (ręczny krok użytkownika)
- [ ] Włączyć **Identity Platform** w konsoli GCP: `console.cloud.google.com` → APIs → Identity Platform → Enable
- [ ] W Firebase Console → Authentication → Sign-in method → weryfikacja, że TOTP MFA jest dostępny
- [ ] Projekt musi być na planie **Blaze**

### Krok 2.1: Instalacja qrcode.react [ ]
- **RUN** `cd app && npm install qrcode.react`
- `npm run build`

### Krok 2.2: Typy i API security [ ]
- **CREATE** `app/src/features/settings/types/security.ts` — Typy: `MfaState`, `RecoveryCode`
- **CREATE** `app/src/features/settings/api/security.ts` — Funkcje: `enrollTotp()`, `verifyTotpEnrollment()`, `unenrollTotp()`, `generateRecoveryCodes()`, `saveRecoveryCodes()` (hashowane w Firestore `users/{uid}/security/recoveryCodes`)
- `npm run build`

### Krok 2.3: SecurityTab — UI rejestracji 2FA [ ]
- **CREATE** `app/src/features/settings/components/SecurityTab.tsx` — Zakładka "Bezpieczeństwo". Status MFA. Przycisk "Włącz weryfikację dwuetapową" → flow: QR code (qrcode.react `<QRCodeSVG>`) z nazwą "CRM Pro ({email})" → pole na 6-cyfrowy kod → weryfikacja → wyświetlenie 5 kodów zapasowych z przyciskiem "Skopiuj" i ostrzeżeniem "Zapisz te kody w bezpiecznym miejscu".
- `npm run build`

### Krok 2.4: Integracja SecurityTab w SettingsPage [ ]
- **MODIFY** `app/src/features/settings/components/SettingsPage.tsx` — Nowa zakładka `"security"` z ikoną `Shield`. Import SecurityTab. TABS array update.
- Zakładka się renderuje

### Krok 2.5: MFA challenge na logowaniu [ ]
- **MODIFY** `app/src/features/auth/components/LoginPage.tsx` — Catch `auth/multi-factor-auth-required`. Przechowanie `resolver` w state. Wyświetlenie MfaChallengeDialog.
- **CREATE** `app/src/features/auth/components/MfaChallengeDialog.tsx` — Modal: pole na 6-cyfrowy kod TOTP + link "Użyj kodu zapasowego". `TotpMultiFactorGenerator.assertionForSignIn()` + `resolver.resolveSignIn()`.
- Login działa dla MFA i nie-MFA users

### Krok 2.6: Recovery code — Cloud Function [ ]
- **MODIFY** `functions/src/index.ts` — Nowa callable `disableMfaWithRecoveryCode`: przyjmuje recovery code, weryfikuje hash w Firestore, unenrolluje MFA przez Admin SDK, oznacza kod jako użyty.
- `cd functions && npm run build`

### Krok 2.7: Recovery code — UI flow [ ]
- **MODIFY** `app/src/features/auth/components/MfaChallengeDialog.tsx` — Widok "Kod zapasowy": input na 8-znakowy kod, wywołanie Cloud Function `disableMfaWithRecoveryCode`, po sukcesie → ponowne logowanie.
- Recovery flow działa end-to-end

### Krok 2.8: Wyłączanie MFA [ ]
- **MODIFY** `app/src/features/settings/components/SecurityTab.tsx` — Sekcja "Wyłącz 2FA": wymaga wpisania aktualnego kodu TOTP jako potwierdzenie. Wywołanie `multiFactor.unenroll()`.
- Można włączyć i wyłączyć 2FA

### Krok 2.9: Update typów profilu [ ]
- **MODIFY** `app/src/types/user.ts` — Opcjonalne pole `mfaEnabled?: boolean`
- **MODIFY** `app/src/store/useAuthStore.ts` — Śledzenie MFA z `user.multiFactor.enrolledFactors`
- Profil odzwierciedla status MFA

---

## FAZA 3: Push Notifications + Cloud Tasks (~12 mikro-kroków)

### Prerequisite (ręczny krok użytkownika)
- [ ] Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Wygenerować klucz VAPID
- [ ] GCP Console → APIs → Cloud Tasks API → Enable
- [ ] Utworzyć kolejkę: `gcloud tasks queues create task-reminders --location=europe-west1 --max-dispatches-per-second=10 --max-attempts=3`

### Krok 3.1: FCM config + messaging singleton [ ]
- **MODIFY** `app/.env.local` — Dodanie `VITE_FIREBASE_VAPID_KEY=...`
- **CREATE** `app/src/lib/messaging.ts` — `getFirebaseMessaging()` singleton, `requestFcmToken(vapidKey)`, `onForegroundMessage(callback)`
- `npm run build`

### Krok 3.2: Service Worker dla background push [ ]
- **CREATE** `app/public/firebase-messaging-sw.js` — Importuje firebase compat SDK z CDN. `messaging.onBackgroundMessage()` → `self.registration.showNotification()`. Handler `notificationclick` → `clients.openWindow(url)`.
- **MODIFY** `app/vite.config.ts` — Dodanie `firebase-messaging-sw.js` do `includeAssets`
- Build + SW dostępny pod `/firebase-messaging-sw.js`

### Krok 3.3: API notyfikacji (klient) [ ]
- **CREATE** `app/src/features/settings/api/notifications.ts` — `requestNotificationPermission()`, `saveFcmToken(uid, token)` → Firestore `users/{uid}/settings/notifications`, `removeFcmToken(uid)`
- `npm run build`

### Krok 3.4: NotificationsTab UI [ ]
- **CREATE** `app/src/features/settings/components/NotificationsTab.tsx` — Zakładka "Powiadomienia". Status uprawnień przeglądarki. Przycisk "Włącz powiadomienia" → `requestPermission()` + zapis tokenu. Dropdown: czas przypomnienia (5/10/15/30/60 min). Toggle włącz/wyłącz. Przycisk "Wyślij testowe powiadomienie".
- `npm run build`

### Krok 3.5: Integracja NotificationsTab w SettingsPage [ ]
- **MODIFY** `app/src/features/settings/components/SettingsPage.tsx` — Nowa zakładka `"notifications"` z ikoną `Bell`. Import NotificationsTab.
- 5 zakładek: Ogólne, Wygląd, Bezpieczeństwo, Integracje, Powiadomienia

### Krok 3.6: Foreground notification handler [ ]
- **MODIFY** `app/src/App.tsx` — Import `onForegroundMessage()`. Wyświetlenie in-app toast (shadcn toast) z tytułem i body notyfikacji.
- Toast pojawia się przy foreground push

### Krok 3.7: Cloud Tasks — scheduling helper [ ]
- **RUN** `cd functions && npm install @google-cloud/tasks`
- **CREATE** `functions/src/notifications.ts` — `scheduleTaskReminder(uid, taskId, reminderTime)`: tworzy Cloud Task w kolejce `task-reminders`, scheduled na dokładny czas `dueDate - reminderMin`. Task name: `{uid}-{taskId}-{timestamp}` (dedup). `cancelTaskReminder(uid, taskId)`: usuwa istniejący Cloud Task.
- `cd functions && npm run build`

### Krok 3.8: HTTP endpoint — wysyłka powiadomienia [ ]
- **MODIFY** `functions/src/index.ts` — Nowa `onRequest` function `sendTaskReminder`: odczyt taska z Firestore (czy istnieje, czy nie completed), odczyt FCM tokenów z `users/{uid}/settings/notifications`, `admin.messaging().send()` z tytułem/body/ikoną/click_action. Ustawienie flagi `notificationSentAt`.
- `cd functions && npm run build`

### Krok 3.9: Firestore trigger — auto-scheduling [ ]
- **MODIFY** `functions/src/index.ts` — Nowy trigger `onTaskWrite` na `users/{uid}/tasks/{taskId}`. Logika: jeśli `dueDate` się zmienił → cancel stary Cloud Task + schedule nowy. Jeśli task usunięty/completed → cancel Cloud Task. Jeśli brak `dueDate` → skip.
- `cd functions && npm run build`

### Krok 3.10: Token refresh + auth integration [ ]
- **MODIFY** `app/src/lib/messaging.ts` — Dodanie obsługi token refresh (`onTokenRefresh` → update Firestore)
- **MODIFY** `app/src/App.tsx` — Po zalogowaniu, jeśli notifications enabled → refresh FCM token
- Token zawsze aktualny

### Krok 3.11: Multi-device + cleanup [ ]
- **MODIFY** `app/src/features/settings/api/notifications.ts` — Zapis tokenów jako `fcmTokens/{tokenHash}` (sub-collection) zamiast jednego dokumentu. Cleanup starych tokenów przy logout.
- Działa na wielu urządzeniach

### Krok 3.12: Test end-to-end + notification click [ ]
- **MODIFY** `app/public/firebase-messaging-sw.js` — `notificationclick`: otwiera `/tasks` lub `/calendar` w zależności od payload
- Weryfikacja: test button w NotificationsTab → push przychodzi → klik otwiera task
- Pełny flow działa

---

## Weryfikacja per faza

### Faza 1
- `npm run build` po każdym kroku
- Wizualny check: każdy widok (Dashboard, Pipeline, Kalendarz, Klienci, Zadania, Leady, Settings, Login, Onboarding) wygląda poprawnie w **obu** motywach
- Przełącznik działa, persystuje, nie powoduje FOUC
- `system` mode reaguje na zmianę preferencji OS

### Faza 2
- Login bez MFA → działa jak dotychczas
- Włączenie MFA → QR code skanuje się w Google Authenticator
- Login z MFA → wymaga kodu TOTP
- Recovery code → wyłącza MFA, pozwala zalogować się bez TOTP
- Wyłączenie MFA w Settings → login bez kodu

### Faza 3
- Włączenie notyfikacji → przeglądarka pyta o uprawnienia
- Test push → przychodzi natychmiast (foreground: toast, background: OS notification)
- Utworzenie taska z `dueDate` → Cloud Task zaplanowany
- O czasie `dueDate - reminderMin` → push przychodzi
- Klik w notyfikację → otwiera CRM na właściwym widoku

---

## Kluczowe pliki

| Plik | Fazy | Rola |
|------|------|------|
| `app/src/index.css` | 1 | Architektura CSS variables, @utility glass |
| `app/src/store/useThemeStore.ts` | 1 | Nowy: theme store |
| `app/src/features/settings/components/SettingsPage.tsx` | 1,2,3 | Hub: 5 zakładek |
| `app/src/features/settings/components/SecurityTab.tsx` | 2 | Nowy: 2FA enrollment |
| `app/src/features/settings/components/NotificationsTab.tsx` | 3 | Nowy: push config |
| `app/src/features/auth/components/LoginPage.tsx` | 2 | MFA challenge flow |
| `app/src/features/auth/components/MfaChallengeDialog.tsx` | 2 | Nowy: TOTP input dialog |
| `app/src/lib/messaging.ts` | 3 | Nowy: FCM singleton |
| `app/public/firebase-messaging-sw.js` | 3 | Nowy: background push SW |
| `functions/src/index.ts` | 2,3 | Recovery code CF + push sender + task trigger |
| `functions/src/notifications.ts` | 3 | Nowy: Cloud Tasks scheduling |

## Ryzyka

| Ryzyko | Mitygacja |
|--------|-----------|
| Glass effect brzydki w light mode | Zaprojektować light glass: `rgba(255,255,255,0.7)` + subtleny cień. Test wizualny. |
| Tailwind v4 `@custom-variant` zachowuje się inaczej niż oczekiwane | Test na jednym komponencie (Sidebar) przed masowym refaktorem |
| Identity Platform nie włączony | Instrukcja w prerequisite Fazy 2. Sprawdzić PRZED kodowaniem. |
| PWA SW konflikt z FCM SW | Osobne pliki: PWA SW generowany przez vite-plugin-pwa, FCM SW ręczny w /public |
| iOS Safari ograniczenia push | Dokumentacja: działa od iOS 16.4+ po "Dodaj do ekranu głównego" |

## Legenda statusów

| Symbol | Status |
|--------|--------|
| [ ] | Do zrobienia |
| [~] | W trakcie |
| [x] | Gotowe |
| [-] | Pominięte |
