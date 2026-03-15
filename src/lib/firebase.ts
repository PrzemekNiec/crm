import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";

// ─── Config ──────────────────────────────────────────────────
// Values are safe to expose in client-side code — Firestore
// Security Rules are the actual access control layer.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ─── Singleton instances ─────────────────────────────────────
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/**
 * Firebase App — initialized once, lazily.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Firebase Auth — always available (does not depend on device mode).
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export const googleProvider = new GoogleAuthProvider();

// ─── Firestore with dynamic cache ───────────────────────────
//
// PRD v3.1 requirement: Firestore cache strategy depends on the
// user's device mode choice made during onboarding.
//
// Problem: `initializeFirestore` can only be called ONCE per app.
// After that, calling it again throws. `getFirestore()` returns
// the default instance (memory cache, no persistence).
//
// Solution: Defer Firestore initialization until we know the
// device mode. All code that needs Firestore calls `getDb()`
// which throws a clear error if called before initialization.
// The onboarding flow calls `initFirestore()` exactly once.

type DeviceMode = "trusted" | "shared";

/**
 * Initialize Firestore with the appropriate cache strategy.
 * MUST be called exactly once — during onboarding or app boot
 * (after reading deviceMode from localStorage fallback).
 */
export function initFirestore(deviceMode: DeviceMode): Firestore {
  if (db) {
    return db;
  }

  const localCache =
    deviceMode === "trusted"
      ? persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        })
      : memoryLocalCache();

  db = initializeFirestore(getFirebaseApp(), { localCache });
  return db;
}

/**
 * Get the Firestore instance. Throws if `initFirestore` hasn't
 * been called yet — this is intentional to catch initialization
 * order bugs early in development.
 */
export function getDb(): Firestore {
  if (!db) {
    throw new Error(
      "[Firebase] Firestore not initialized. " +
        "Call initFirestore(deviceMode) first — typically during " +
        "app boot or onboarding."
    );
  }
  return db;
}

/**
 * Check whether Firestore has been initialized.
 * Used by the app shell to decide whether to show the
 * onboarding or go straight to the main layout.
 */
export function isFirestoreInitialized(): boolean {
  return db !== null;
}
