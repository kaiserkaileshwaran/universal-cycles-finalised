import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth as firebaseGetAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import { getDatabase as firebaseGetDatabase, connectDatabaseEmulator, type Database } from "firebase/database";
import { getStorage as firebaseGetStorage } from "firebase/storage";

const isClient = typeof window !== "undefined";

function shouldUseEmulator(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1" ||
    (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "3200")
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBNSjzx2BbTLeI_qUuOCQCHL0jj_uQSIDk",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "universal-cycles-a209c.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://universal-cycles-a209c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "universal-cycles-a209c",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "universal-cycles-a209c.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1058429575616",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1058429575616:web:2c3b4b5b1a18f4abc3a825",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-5WQY6BVBLM",
};

const isFirebaseConfigValid = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
let storage: ReturnType<typeof firebaseGetStorage> | null = null;
let authEmulatorConnected = false;
let dbEmulatorConnected = false;

function ensureApp(): FirebaseApp | null {
  if (!isClient || !isFirebaseConfigValid) return null;
  if (!app) {
    const useEmu = shouldUseEmulator();
    const activeConfig = useEmu
      ? {
          ...firebaseConfig,
          databaseURL: "http://127.0.0.1:9000/?ns=demo-universal-cycles-default-rtdb",
          projectId: "demo-universal-cycles",
        }
      : firebaseConfig;
    app = getApps().length > 0 ? getApp() : initializeApp(activeConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  const currentApp = ensureApp();
  if (!currentApp) {
    throw new Error("Firebase auth is not initialized. Ensure Firebase config is set and code runs in the browser.");
  }
  if (!auth) {
    try {
      auth = initializeAuth(currentApp, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      auth = firebaseGetAuth(currentApp);
    }
    if (shouldUseEmulator() && !authEmulatorConnected) {
      authEmulatorConnected = true;
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
  }
  return auth;
}

export function getFirebaseDatabase(): Database {
  const currentApp = ensureApp();
  if (!currentApp) {
    throw new Error("Firebase database is not initialized. Ensure Firebase config is set and code runs in the browser.");
  }
  if (!db) {
    db = firebaseGetDatabase(currentApp);
    if (shouldUseEmulator() && !dbEmulatorConnected) {
      dbEmulatorConnected = true;
      connectDatabaseEmulator(db, "127.0.0.1", 9000);
    }
  }
  return db;
}

export function getFirebaseStorage(): ReturnType<typeof firebaseGetStorage> {
  const currentApp = ensureApp();
  if (!currentApp) {
    throw new Error("Firebase storage is not initialized. Ensure Firebase config is set and code runs in the browser.");
  }
  if (!storage) {
    storage = firebaseGetStorage(currentApp);
  }
  return storage;
}

export function isFirebaseConfigured(): boolean {
  return isClient && isFirebaseConfigValid;
}

export function runWhenInteractive(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const pathname = window.location.pathname;
  const isDeferredPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/products/p1" ||
    pathname === "/category/adult-cycles";

  let hasStoredAuth = false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k === "uc_has_auth_session" || k.startsWith("firebase:authUser:"))) {
        hasStoredAuth = true;
        break;
      }
    }
    if (!hasStoredAuth && window.sessionStorage.getItem("uc_seeded_products") === "1") {
      hasStoredAuth = true;
    }
  } catch {
    // ignore storage access issues
  }

  if (!isDeferredPublicRoute || hasStoredAuth) {
    callback();
    return () => {};
  }

  let done = false;
  const events = ["pointerdown", "keydown", "touchstart", "focusin", "scroll", "click"] as const;

  const cleanupListeners = () => {
    for (const ev of events) {
      window.removeEventListener(ev, trigger, { capture: true });
    }
  };

  function trigger() {
    if (done) return;
    done = true;
    cleanupListeners();
    callback();
  }

  for (const ev of events) {
    window.addEventListener(ev, trigger, { capture: true, passive: true });
  }
  const timer = window.setTimeout(trigger, 6500);

  return () => {
    done = true;
    window.clearTimeout(timer);
    cleanupListeners();
  };
}
