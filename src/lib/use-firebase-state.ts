"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ref, onValue, set } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseDatabase, isFirebaseConfigured, getFirebaseAuth, runWhenInteractive } from "@/firebase/firebase";

// Helper to strip 'undefined' values which cause Firebase RTDB crashes
export function sanitizeForFirebase(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirebase);
  }
  const result: Record<string, unknown> = {};
  for (const key in value as Record<string, unknown>) {
    if ((value as Record<string, unknown>)[key] !== undefined) {
      result[key] = sanitizeForFirebase((value as Record<string, unknown>)[key]);
    }
  }
  return result;
}

function wasPathPreviouslySeeded(path: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(`uc_seeded_${path}`) === "1";
  } catch {
    return false;
  }
}

function markPathSeeded(path: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`uc_seeded_${path}`, "1");
  } catch {}
}

async function ensureEmulatorAdminVerified(user: { uid?: string; email?: string | null; emailVerified?: boolean; getIdToken: (forceRefresh?: boolean) => Promise<string> } | null | undefined): Promise<void> {
  if (!user || user.email?.toLowerCase() !== "admin@gmail.com" || user.emailVerified) return;
  if (
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1" ||
    (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "3200")
  ) {
    try {
      await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=fake", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: "Bearer owner" },
        body: JSON.stringify({ localId: user.uid, emailVerified: true }),
      });
      await user.getIdToken(true);
    } catch {}
  }
}

export function useFirebaseState<T>(path: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState<boolean>(false);
  const stateRef = useRef<T>(initialValue);
  const initialRef = useRef<T>(initialValue);
  const isDbEmptyRef = useRef<boolean>(false);
  const hasExistedRef = useRef<boolean>(false);

  // Keep ref in sync for the setter
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoaded(true);
      return;
    }

    if (wasPathPreviouslySeeded(path)) {
      hasExistedRef.current = true;
    }

    let unsubscribe: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;

    const cancelInteractive = runWhenInteractive(() => {
      try {
        const db = getFirebaseDatabase();
        const dbRef = ref(db, path);
        const auth = getFirebaseAuth();

        unsubscribe = onValue(
          dbRef,
          (snapshot) => {
            const data = snapshot.val();
            if (data !== null) {
              isDbEmptyRef.current = false;
              hasExistedRef.current = true;
              markPathSeeded(path);
              // Handle both Array and Object map formats from Firebase RTDB
              const nextVal = (
                Array.isArray(initialRef.current) && !Array.isArray(data) && typeof data === "object"
                  ? Object.values(data)
                  : data
              ) as T;
              if (JSON.stringify(nextVal) !== JSON.stringify(stateRef.current)) {
                setState(nextVal);
              }
              setLoaded(true);
            } else {
              // If the path already had data or was explicitly modified by admin (e.g. deleting the last item),
              // keep it empty instead of re-seeding defaults.
              if (hasExistedRef.current || wasPathPreviouslySeeded(path)) {
                isDbEmptyRef.current = false;
                if (Array.isArray(initialRef.current)) {
                  const emptyArr = [] as unknown as T;
                  if (JSON.stringify(emptyArr) !== JSON.stringify(stateRef.current)) {
                    setState(emptyArr);
                  }
                }
                setLoaded(true);
                return;
              }

              isDbEmptyRef.current = true;
              // Database node is empty on fresh store setup.
              // Only attempt initial seed write if the user is authenticated as admin.
              const currentUser = auth?.currentUser;
              const isAdmin = currentUser?.email?.toLowerCase() === "admin@gmail.com";

              if (isAdmin) {
                isDbEmptyRef.current = false;
                hasExistedRef.current = true;
                markPathSeeded(path);
                ensureEmulatorAdminVerified(currentUser).then(() =>
                  set(dbRef, sanitizeForFirebase(initialRef.current)).catch((err) => {
                    console.warn(`[Firebase RTDB] Seed write suppressed for "${path}":`, err?.message || err);
                  })
                );
              }
              setLoaded(true);
            }
          },
          (error) => {
            // Gracefully suppress permission warnings for unauthenticated public reads
            console.warn(`[Firebase RTDB] Read notice for "${path}":`, error.message);
            setLoaded(true);
          }
        );

        unsubAuth = auth
          ? onAuthStateChanged(auth, (user) => {
              if (
                isDbEmptyRef.current &&
                !hasExistedRef.current &&
                !wasPathPreviouslySeeded(path) &&
                user?.email?.toLowerCase() === "admin@gmail.com"
              ) {
                isDbEmptyRef.current = false;
                hasExistedRef.current = true;
                markPathSeeded(path);
                ensureEmulatorAdminVerified(user).then(() =>
                  set(dbRef, sanitizeForFirebase(initialRef.current)).catch((err) => {
                    console.warn(`[Firebase RTDB] Seed write suppressed for "${path}":`, err?.message || err);
                  })
                );
              }
            })
          : undefined;
      } catch (err) {
        console.warn(`[Firebase RTDB] Connection notice for "${path}":`, err);
        setLoaded(true);
      }
    });

    return () => {
      cancelInteractive();
      unsubscribe?.();
      unsubAuth?.();
    };
  }, [path]);

  const setFirebaseState = useCallback((action: React.SetStateAction<T>) => {
    hasExistedRef.current = true;
    isDbEmptyRef.current = false;
    markPathSeeded(path);
    const nextState = typeof action === "function" ? (action as (prevState: T) => T)(stateRef.current) : action;
    if (isFirebaseConfigured()) {
      try {
        const currentUser = getFirebaseAuth()?.currentUser;
        ensureEmulatorAdminVerified(currentUser).then(() =>
          set(ref(getFirebaseDatabase(), path), sanitizeForFirebase(nextState)).catch((err) => {
            console.warn(`[Firebase RTDB] Write restricted for "${path}":`, err?.message || err);
          })
        );
      } catch (err) {
        console.warn(`[Firebase RTDB] Failed to initiate write for "${path}":`, err);
      }
    }
    setState(nextState); // Optimistic update
    setLoaded(true);
  }, [path]);

  return [state, setFirebaseState, loaded];
}
