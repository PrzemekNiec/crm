import { Outlet } from "react-router-dom";
import { NavLink } from "react-router-dom";
import { LogOut, Menu, X, Sun, Moon, Zap, Settings } from "lucide-react";
import { useState } from "react";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useAuthStore } from "@/store/useAuthStore";
import { useTheme } from "@/lib/useTheme";
import { Sidebar, MOBILE_NAV_ITEMS } from "./Sidebar";
import { cn } from "@/lib/cn";
import { WifiOff } from "lucide-react";

// ─── Offline banner ──────────────────────────────────────────

function OfflineBanner() {
  const isOnline = useNetworkState();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Brak połączenia. Działasz w trybie offline. Zmiany zostaną
      zsynchronizowane po odzyskaniu sieci.
    </div>
  );
}

// ─── Mobile top bar ──────────────────────────────────────────

function MobileTopbar() {
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials =
    profile?.displayName
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] backdrop-blur-xl px-4 md:hidden">
      <div className="flex items-center gap-2">
        <img
          src="/logo.svg"
          alt="CRM Pro"
          className="h-7 w-7 rounded-md"
        />
        <span className="text-sm font-semibold text-foreground">Panel Eksperta</span>
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "Zamknij menu" : "Otwórz menu"}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
      >
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop – closes menu on tap outside */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Dropdown panel */}
      {menuOpen && (
        <div className="absolute right-4 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-2 shadow-xl">
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName ?? "Awatar"}
                className="h-8 w-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                {initials}
              </div>
            )}
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium text-foreground">
                {profile?.displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.email}
              </p>
            </div>
          </div>

          <div className="my-1 border-t border-border" />

          {/* Links not in bottom nav */}
          <NavLink
            to="/leads"
            onClick={() => setMenuOpen(false)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Zap className="h-4 w-4" />
            Potencjalni
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setMenuOpen(false)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Ustawienia
          </NavLink>

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            onClick={() => {
              toggleTheme();
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Wyloguj
          </button>
        </div>
      )}
    </header>
  );
}

// ─── Mobile bottom navigation ────────────────────────────────

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-background md:hidden">
      {MOBILE_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

// ─── Main layout ─────────────────────────────────────────────

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden">
      <OfflineBanner />

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col">
          <MobileTopbar />

          <main className="flex-1 overflow-y-auto pb-20 md:pb-0 bg-[var(--surface-2)] backdrop-blur-sm">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
