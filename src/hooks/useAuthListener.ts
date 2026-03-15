import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getDb, isFirestoreInitialized } from "@/lib/firebase";
import { useAuthStore, getPersistedDeviceMode } from "@/store/useAuthStore";
import { initFirestore } from "@/lib/firebase";
import type { UserProfile } from "@/types/user";

/**
 * Listens to Firebase Auth state changes and hydrates the auth store.
 *
 * On first login, creates the user profile document in Firestore.
 * On subsequent logins, reads the profile and updates lastLoginAt.
 *
 * Must be mounted once at the app root level.
 */
export function useAuthListener(): void {
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      // Ensure Firestore is initialized before accessing it.
      // If the user already has a persisted device mode, use it.
      // If not (first-time user), they'll go through onboarding.
      if (!isFirestoreInitialized()) {
        const persisted = getPersistedDeviceMode();
        if (persisted) {
          initFirestore(persisted);
        } else {
          // First time user — Firestore will be initialized
          // during onboarding. Mark auth as ready so the app
          // can route to onboarding.
          setAuthReady(true);
          return;
        }
      }

      try {
        const userRef = doc(getDb(), "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const profile = snap.data() as UserProfile;
          setProfile(profile);

          // Update lastLoginAt silently
          await setDoc(
            userRef,
            { lastLoginAt: serverTimestamp() },
            { merge: true }
          ).catch(() => {
            // Non-critical — don't block app boot
          });
        } else {
          // New user — profile will be created during onboarding.
          setProfile(null);
        }
      } catch (error) {
        console.error("[Auth] Failed to load user profile:", error);
        setProfile(null);
      }

      setAuthReady(true);
    });

    return unsubscribe;
  }, [setUser, setProfile, setAuthReady]);
}
