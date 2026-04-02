import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthListener } from "@/hooks/useAuthListener";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { ToastContainer } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// ─── Lazy-loaded Google OAuth (334 kB saved on login screen) ─
const LazyGoogleOAuthProvider = lazy(() =>
  import("@react-oauth/google").then((m) => ({
    default: m.GoogleOAuthProvider,
  }))
);

// ─── Lazy-loaded pages ──────────────────────────────────────

const DashboardPage = lazy(() => import("@/features/dashboard/components/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ClientsPage = lazy(() => import("@/features/clients/components/ClientsPage").then((m) => ({ default: m.ClientsPage })));
const ClientDetailsPage = lazy(() => import("@/features/clients/components/ClientDetailsPage").then((m) => ({ default: m.ClientDetailsPage })));
const TasksPage = lazy(() => import("@/features/tasks/components/TasksPage").then((m) => ({ default: m.TasksPage })));
const LeadsPage = lazy(() => import("@/features/leads/components/LeadsPage").then((m) => ({ default: m.LeadsPage })));
const PipelinePage = lazy(() => import("@/features/deals/components/PipelinePage").then((m) => ({ default: m.PipelinePage })));
const CalendarView = lazy(() => import("@/features/calendar/components/CalendarView").then((m) => ({ default: m.CalendarView })));
const SettingsPage = lazy(() => import("@/features/settings/components/SettingsPage").then((m) => ({ default: m.SettingsPage })));

// ─── Page wrapper (ErrorBoundary + Suspense) ────────────────

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

// ─── Config ─────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function AppInner() {
  useAuthListener();

  return (
    <AuthGuard>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Page><DashboardPage /></Page>} />
          <Route path="clients" element={<Page><ClientsPage /></Page>} />
          <Route path="clients/:id" element={<Page><ClientDetailsPage /></Page>} />
          <Route path="tasks" element={<Page><TasksPage /></Page>} />
          <Route path="leads" element={<Page><LeadsPage /></Page>} />
          <Route path="pipeline" element={<Page><PipelinePage /></Page>} />
          <Route path="calendar" element={<Page><CalendarView /></Page>} />
          <Route path="settings" element={<Page><SettingsPage /></Page>} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}

function GoogleOAuthGate({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => !!s.user);

  if (!isLoggedIn) return <>{children}</>;

  return (
    <Suspense fallback={<>{children}</>}>
      <LazyGoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {children}
      </LazyGoogleOAuthProvider>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Aplikacja napotkała krytyczny błąd">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GoogleOAuthGate>
            <AppInner />
            <ToastContainer />
          </GoogleOAuthGate>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
