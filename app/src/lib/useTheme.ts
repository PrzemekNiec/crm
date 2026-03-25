import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "crm-theme";
const DEFAULT_THEME: Theme = "dark";

// ─── Shared mutable state (singleton) ────────────────────────
let currentTheme: Theme = DEFAULT_THEME;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;

  // Update meta theme-color for PWA / mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#1a1d21" : "#f0ece4");
  }
}

// ─── Init (runs once at import time) ─────────────────────────
function initTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") {
      currentTheme = stored;
    }
  } catch {
    // localStorage unavailable — keep default
  }
  applyTheme(currentTheme);
}

initTheme();

// ─── Public API ──────────────────────────────────────────────

function getSnapshot(): Theme {
  return currentTheme;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setTheme = useCallback((next: Theme) => {
    currentTheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    applyTheme(next);
    notifyListeners();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggleTheme } as const;
}
