import { Outlet } from "react-router-dom";
import { OfflineBanner } from "@/components/OfflineBanner";

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OfflineBanner />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
