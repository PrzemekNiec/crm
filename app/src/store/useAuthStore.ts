import { create } from "zustand";
import type { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { getFirebaseAuth, initFirestore } from "@/lib/firebase";
import type { DeviceMode, UserProfile } from "@/types/user";

// ─── Persisted device mode ───────────────────────────────────
// We persist deviceMode to localStorage so that on subsequent
// app boots we can initialize Firestore BEFORE the auth state
// is resolved (user profile is in Firestore, but we need
// Firestore to be initialized to read it — chicken-and-egg).

const DEVICE_MODE_KEY = "crm:deviceMode";

export function getPersistedDeviceMode(): DeviceMode | null {
  try {
    const raw = localStorage.getItem(DEVICE_MODE_KEY);
    if (raw === "trusted" || raw === "shared") return raw;
  } catch {
    // localStorage not available (e.g. incognito Safari)
  }
  return null;
}

function persistDeviceMode(mode: DeviceMode): void {
  try {
    localStorage.setItem(DEVICE_MODE_KEY, mode);
  } catch {
    // silent
  }
}

// ─── Store definition ────────────────────────────────────────

interface AuthState {
  /** Firebase Auth user object (null = not logged in / loading) */
  user: User | null;
  /** User profile from Firestore */
  profile: UserProfile | null;
  /** Whether the initial auth check has completed */
  authReady: boolean;
  /** Whether onboarding has been completed */
  onboardingCompleted: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setAuthReady: (ready: boolean) => void;

  /**
   * Set device mode during onboarding.
   * Initializes Firestore with the appropriate cache strategy
   * and persists the choice to localStorage.
   */
  setDeviceMode: (mode: DeviceMode) => void;

  /** Sign out and clear store state. */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  authReady: false,
  onboardingCompleted: false,

  setUser: (user) => set({ user }),

  setProfile: (profile) =>
    set({
      profile,
      onboardingCompleted: profile?.onboardingCompleted ?? false,
    }),

  setAuthReady: (authReady) => set({ authReady }),

  setDeviceMode: (mode) => {
    persistDeviceMode(mode);
    initFirestore(mode);
  },

  logout: async () => {
    await signOut(getFirebaseAuth());
    set({
      user: null,
      profile: null,
      onboardingCompleted: false,
    });
  },
}));
