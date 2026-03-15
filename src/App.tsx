import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthListener } from "@/hooks/useAuthListener";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { ToastContainer } from "@/components/ui/Toast";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { ClientsPage } from "@/features/clients/components/ClientsPage";

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
          {/* Phase 1 — remaining routes:
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="clients/:id/edit" element={<ClientFormPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="settings" element={<SettingsPage />} />
          */}
        </Route>
      </Routes>
    </AuthGuard>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
