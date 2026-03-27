import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Zap,
  Kanban,
  Calendar,
  Settings,
  LogOut,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/useTheme";

// ─── Nav config (shared with MobileNav in AppShell) ─────────

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Klienci", icon: Users },
  { to: "/tasks", label: "Zadania", icon: CheckSquare },
  { to: "/leads", label: "Potencjalni", icon: Zap },
  { to: "/pipeline", label: "Lejek", icon: Kanban },
  { to: "/calendar", label: "Kalendarz", icon: Calendar },
  { to: "/settings", label: "Ustawienia", icon: Settings },
];

/** Items shown in mobile bottom navigation */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Start", icon: LayoutDashboard },
  { to: "/clients", label: "Klienci", icon: Users },
  { to: "/tasks", label: "Zadania", icon: CheckSquare },
  { to: "/leads", label: "Leady", icon: Zap },
  { to: "/pipeline", label: "Lejek", icon: Kanban },
  { to: "/calendar", label: "Kalendarz", icon: Calendar },
];

// ─── Sidebar (desktop only) ─────────────────────────────────

export function Sidebar() {
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useTheme();

  const initials =
    profile?.displayName
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] backdrop-blur-xl">
      {/* Logo / brand */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <img
          src="/logo.svg"
          alt="CRM Pro"
          className="h-8 w-8 rounded-md"
        />
        <span className="text-sm font-semibold text-foreground">
          Panel Eksperta
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-3">
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
              {profile?.displayName ?? "Użytkownik"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.email ?? ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}
        </button>
        <button
          type="button"
          onClick={logout}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Wyloguj
        </button>
      </div>
    </aside>
  );
}
