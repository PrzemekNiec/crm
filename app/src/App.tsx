import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useAuthListener } from "@/hooks/useAuthListener";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { ToastContainer } from "@/components/ui/Toast";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { ClientsPage } from "@/features/clients/components/ClientsPage";
import { TasksPage } from "@/features/tasks/components/TasksPage";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { LeadsPage } from "@/features/leads/components/LeadsPage";
import { ClientDetailsPage } from "@/features/clients/components/ClientDetailsPage";

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
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="clients/:id" element={<ClientDetailsPage />} />
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
