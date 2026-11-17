"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { 
  User, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  browserPopupRedirectResolver,
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { ref, get, set, update } from "firebase/database";
import { getFirebaseAuth, getFirebaseDatabase, isFirebaseConfigured, runWhenInteractive } from "@/firebase/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: (forceRedirect?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncUserToDatabase(currentUser: User) {
  try {
    if (
      currentUser.email?.toLowerCase() === "admin@gmail.com" &&
      !currentUser.emailVerified &&
      (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1" ||
        (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "3200"))
    ) {
      try {
        await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=fake", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: "Bearer owner" },
          body: JSON.stringify({ localId: currentUser.uid, emailVerified: true }),
        });
        await currentUser.getIdToken(true);
      } catch {}
    }

    const db = getFirebaseDatabase();
    const userRef = ref(db, `users/${currentUser.uid}`);
    const snapshot = await get(userRef);
    const now = Date.now();
    
    if (!snapshot.exists()) {
      const nameParts = (currentUser.displayName || "").trim().split(" ");
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(" ") || "";
      await set(userRef, {
        id: currentUser.uid,
        uid: currentUser.uid,
        firstName,
        lastName,
        displayName: currentUser.displayName || firstName,
        email: currentUser.email,
        photoURL: currentUser.photoURL || null,
        role: currentUser.email?.toLowerCase() === "admin@gmail.com" ? "admin" : "customer",
        createdAt: new Date().toISOString(),
        lastLoginAt: now,
      });
    } else {
      await update(userRef, {
        lastLoginAt: now,
        photoURL: currentUser.photoURL || null,
      });
    }
  } catch (err) {
    console.error("Failed to sync user to database:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    let cancelled = false;
    let unsubRef: (() => void) | undefined;

    const cancelInteractive = runWhenInteractive(async () => {
      if (cancelled) return;
      try {
        const auth = getFirebaseAuth();

        try {
          if (typeof window !== "undefined" && window.sessionStorage.getItem("uc_oauth_redirect") === "1") {
            window.sessionStorage.removeItem("uc_oauth_redirect");
            const redirectRes = await getRedirectResult(auth, browserPopupRedirectResolver);
            if (redirectRes?.user) {
              syncUserToDatabase(redirectRes.user);
              const isAdmin = redirectRes.user.email?.toLowerCase() === "admin@gmail.com";
              window.location.href = isAdmin ? "/admin" : "/account";
            }
          }
        } catch (redirectError) {
          console.error("Redirect sign-in error:", redirectError);
        }

        if (cancelled) return;
        unsubRef = onAuthStateChanged(auth, (currentUser) => {
          setUser((prev) => (prev?.uid === currentUser?.uid ? prev : currentUser));
          setLoading(false);
          try {
            if (typeof window !== "undefined") {
              if (currentUser) {
                window.localStorage.setItem("uc_has_auth_session", "1");
              } else {
                window.localStorage.removeItem("uc_has_auth_session");
              }
            }
          } catch {}
          if (currentUser) {
            syncUserToDatabase(currentUser);
          }
        });
      } catch {
        // Firebase auth unavailable in effect
      }
    });

    return () => {
      cancelled = true;
      cancelInteractive();
      unsubRef?.();
    };
  }, []);

  const signInWithGoogle = async (forceRedirect = false) => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    if (forceRedirect) {
      if (typeof window !== "undefined") window.sessionStorage.setItem("uc_oauth_redirect", "1");
      await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
      return;
    }

    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      // Browsers with third-party cookie restrictions or blocked popup iframes
      // frequently throw auth/unauthorized-domain or auth/popup-blocked on popups.
      // Automatically attempt full-page redirect fallback!
      if (
        err?.code === "auth/popup-blocked" ||
        err?.code === "auth/cancelled-popup-request" ||
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/unauthorized-domain"
      ) {
        try {
          if (typeof window !== "undefined") window.sessionStorage.setItem("uc_oauth_redirect", "1");
          await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
          return;
        } catch {
          const domain = typeof window !== "undefined" ? window.location.hostname : "your domain";
          throw new Error(
            `Domain "${domain}" is not authorized. In Firebase Console -> Authentication -> Settings -> Authorized domains, ensure "${domain}" is added without "https://", and verify Google is Enabled under Sign-in method.`
          );
        }
      } else {
        throw error;
      }
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      // Error sending password reset email
      throw error;
    }
  };

  const signOut = async () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("uc_has_auth_session");
      }
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
    } catch (error) {
      // Error signing out
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
