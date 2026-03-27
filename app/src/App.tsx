import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useAuthListener } from "@/hooks/useAuthListener";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { ToastContainer } from "@/components/ui/Toast";
import { Loader2 } from "lucide-react";

// ─── Lazy-loaded pages ──────────────────────────────────────

const DashboardPage = lazy(() => import("@/features/dashboard/components/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ClientsPage = lazy(() => import("@/features/clients/components/ClientsPage").then((m) => ({ default: m.ClientsPage })));
const ClientDetailsPage = lazy(() => import("@/features/clients/components/ClientDetailsPage").then((m) => ({ default: m.ClientDetailsPage })));
const TasksPage = lazy(() => import("@/features/tasks/components/TasksPage").then((m) => ({ default: m.TasksPage })));
const LeadsPage = lazy(() => import("@/features/leads/components/LeadsPage").then((m) => ({ default: m.LeadsPage })));
const PipelinePage = lazy(() => import("@/features/deals/components/PipelinePage").then((m) => ({ default: m.PipelinePage })));
const CalendarView = lazy(() => import("@/features/calendar/components/CalendarView").then((m) => ({ default: m.CalendarView })));
const SettingsPage = lazy(() => import("@/features/settings/components/SettingsPage").then((m) => ({ default: m.SettingsPage })));

// ─── Suspense fallback ──────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
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
          <Route
            index
            element={
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="clients"
            element={
              <Suspense fallback={<PageLoader />}>
                <ClientsPage />
              </Suspense>
            }
          />
          <Route
            path="clients/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <ClientDetailsPage />
              </Suspense>
            }
          />
          <Route
            path="tasks"
            element={
              <Suspense fallback={<PageLoader />}>
                <TasksPage />
              </Suspense>
            }
          />
          <Route
            path="leads"
            element={
              <Suspense fallback={<PageLoader />}>
                <LeadsPage />
              </Suspense>
            }
          />
          <Route
            path="pipeline"
            element={
              <Suspense fallback={<PageLoader />}>
                <PipelinePage />
              </Suspense>
            }
          />
          <Route
            path="calendar"
            element={
              <Suspense fallback={<PageLoader />}>
                <CalendarView />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </AuthGuard>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppInner />
          <ToastContainer />
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
