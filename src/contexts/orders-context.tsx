"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { equalTo, goOffline, goOnline, onValue, orderByChild, query, ref, set, update } from "firebase/database";
import { getFirebaseDatabase, isFirebaseConfigured } from "@/firebase/firebase";
import { useAuth } from "@/contexts/auth-context";
import { sanitizeForFirebase } from "@/lib/use-firebase-state";
import type { Order } from "@/types";

const PENDING_ORDERS_KEY = "universal-cycles:pending-orders";

function readPendingOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Order[]) : [];
  } catch {
    return [];
  }
}

function writePendingOrders(list: Order[]): void {
  if (typeof window === "undefined") return;
  try {
    if (list.length === 0) {
      window.localStorage.removeItem(PENDING_ORDERS_KEY);
    } else {
      window.localStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function enqueuePendingOrder(order: Order): void {
  const current = readPendingOrders().filter((item) => item.id !== order.id);
  writePendingOrders([order, ...current]);
}

function removePendingOrder(orderId: string): void {
  const current = readPendingOrders();
  const next = current.filter((item) => item.id !== orderId);
  if (next.length !== current.length) {
    writePendingOrders(next);
  }
}

interface OrdersContextValue {
  orders: Order[];
  addOrder: (order: Order) => Promise<void>;
  updateOrder: (orderId: string, patch: Partial<Order>) => Promise<void>;
  watchOrderById: (orderId: string, onOrder: (order: Order | null) => void) => () => void;
}

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

function toPublicOrderTracking(order: Order): Order {
  const rawPhone = (order.shippingAddress?.phone || "").replace(/\D/g, "");
  const last4 = rawPhone.length >= 4 ? rawPhone.slice(-4) : "0000";
  return {
    ...order,
    email: "",
    shippingAddress: {
      id: order.shippingAddress?.id || "redacted",
      label: order.shippingAddress?.label || "Delivery",
      fullName: "Protected Customer",
      phone: `******${last4}`,
      street1: "Protected Delivery Address",
      street2: undefined,
      city: order.shippingAddress?.city || "",
      state: order.shippingAddress?.state || "",
      district: order.shippingAddress?.district || "",
      country: order.shippingAddress?.country || "India",
      zipCode: order.shippingAddress?.zipCode || "",
      isDefault: false,
    },
  };
}

function parseOrdersSnapshot(raw: unknown, keyMap: Record<string, string>): Order[] {
  if (!raw || typeof raw !== "object") return [];
  const entries = Array.isArray(raw)
    ? raw.map((val, idx) => [String(idx), val] as const)
    : Object.entries(raw as Record<string, unknown>);
  const list: Order[] = [];
  for (const [key, value] of entries) {
    if (value && typeof value === "object" && "id" in value) {
      const order = value as Order;
      keyMap[order.id] = key;
      list.push(order);
    }
  }
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === "admin@gmail.com";
  const [orders, setOrders] = useState<Order[]>([]);
  const keyByOrderIdRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!isFirebaseConfigured() || !user) {
      return;
    }

    try {
      const db = getFirebaseDatabase();
      const targetQuery = isAdmin
        ? ref(db, "orders")
        : query(ref(db, "orders"), orderByChild("userId"), equalTo(user.uid));

      const unsubscribe = onValue(
        targetQuery,
        (snapshot) => {
          const nextMap: Record<string, string> = { ...keyByOrderIdRef.current };
          const list = parseOrdersSnapshot(snapshot.val(), nextMap);
          keyByOrderIdRef.current = nextMap;
          setOrders(list);
        },
        () => {
          // Ignore permission notices when switching accounts
        }
      );

      return () => unsubscribe();
    } catch {
      return;
    }
  }, [user, isAdmin]);

  const persistOrderToRtdb = useCallback(async (order: Order) => {
    if (!isFirebaseConfigured()) return;
    const db = getFirebaseDatabase();
    const cleanOrder = sanitizeForFirebase(order);
    const cleanTracking = sanitizeForFirebase(toPublicOrderTracking(order));

    const writeViaRestFallback = async () => {
      const rawDbUrl = db.app.options.databaseURL;
      if (!rawDbUrl) throw new Error("Missing databaseURL");
      const parsed = new URL(rawDbUrl);
      const buildEndpoint = (path: string) => {
        const u = new URL(`${parsed.origin}/${path}.json${parsed.search}`);
        return u.toString();
      };
      const orderRes = await fetch(buildEndpoint(`orders/${encodeURIComponent(order.id)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanOrder),
      });
      if (!orderRes.ok) {
        throw new Error(`RTDB REST write failed: ${orderRes.status}`);
      }
      await fetch(buildEndpoint(`order_tracking/${encodeURIComponent(order.id)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanTracking),
      }).catch(() => {});
    };

    const attemptWrite = async (reconnectFirst: boolean) => {
      if (reconnectFirst) {
        try {
          goOffline(db);
          goOnline(db);
        } catch {
          // Ignore reconnect errors
        }
      }
      const sdkWrite = Promise.all([
        set(ref(db, `orders/${order.id}`), cleanOrder),
        set(ref(db, `order_tracking/${order.id}`), cleanTracking).catch(() => {}),
      ]).then(() => {});

      const restFallback = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          writeViaRestFallback().then(resolve, reject);
        }, 700);
        sdkWrite.then(
          () => clearTimeout(timer),
          () => clearTimeout(timer)
        );
      });

      await Promise.race([sdkWrite, restFallback]);
    };

    const withTimeout = (promise: Promise<void>, ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("rtdb_write_timeout")), ms);
        promise.then(
          () => {
            clearTimeout(timer);
            resolve();
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (navigator.onLine) {
            cleanup();
            resolve();
          }
        };
        const timer = setInterval(check, 300);
        const cleanup = () => {
          clearInterval(timer);
          window.removeEventListener("online", check);
        };
        window.addEventListener("online", check);
      });
      try {
        goOffline(db);
        goOnline(db);
      } catch {
        // Ignore reconnect errors
      }
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await withTimeout(attemptWrite(attempt > 0), 2500);
        removePendingOrder(order.id);
        return;
      } catch (err) {
        const msg = String((err as { code?: string; message?: string })?.code || (err as { message?: string })?.message || err).toLowerCase();
        if (msg.includes("permission_denied") || msg.includes("permission denied") || msg.includes("401")) {
          return;
        }
        if (attempt === 3) throw err;
      }
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || typeof window === "undefined") return;
    const flushPending = () => {
      if (!navigator.onLine) return;
      const pending = readPendingOrders();
      for (const order of pending) {
        persistOrderToRtdb(order).catch(() => {});
      }
    };
    flushPending();
    window.addEventListener("online", flushPending);
    return () => window.removeEventListener("online", flushPending);
  }, [persistOrderToRtdb]);

  const addOrder = useCallback(async (order: Order) => {
    keyByOrderIdRef.current[order.id] = order.id;
    enqueuePendingOrder(order);
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    if (isFirebaseConfigured()) {
      try {
        await persistOrderToRtdb(order);
      } catch {
        // Order remains safely queued in localStorage and local state
      }
    }
  }, [persistOrderToRtdb]);

  const updateOrder = useCallback(async (orderId: string, patch: Partial<Order>) => {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, ...patch } : order))
    );
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseDatabase();
        const dbKey = keyByOrderIdRef.current[orderId] || orderId;
        const cleanPatch = sanitizeForFirebase(patch) as Record<string, unknown>;
        await update(ref(db, `orders/${dbKey}`), cleanPatch).catch(() => {});
        await update(ref(db, `order_tracking/${dbKey}`), cleanPatch).catch(() => {});
      } catch (err) {
        console.warn("[Firebase RTDB] Could not update order:", err);
      }
    }
  }, []);

  const watchOrderById = useCallback((orderId: string, onOrder: (order: Order | null) => void) => {
    const cleanId = orderId.trim();
    if (!cleanId) {
      onOrder(null);
      return () => {};
    }
    const localMatch = readPendingOrders().find((item) => item.id.toUpperCase() === cleanId.toUpperCase());
    if (!isFirebaseConfigured()) {
      onOrder(localMatch ?? null);
      return () => {};
    }
    try {
      const db = getFirebaseDatabase();
      const dbKey = keyByOrderIdRef.current[cleanId] || cleanId;
      let fallbackUnsub: (() => void) | null = null;

      const subscribeTrackingFallback = () => {
        if (fallbackUnsub) return;
        const trackingRef = ref(db, `order_tracking/${dbKey}`);
        fallbackUnsub = onValue(
          trackingRef,
          (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === "object" && "id" in val) {
              onOrder(val as Order);
            } else {
              onOrder(localMatch ?? null);
            }
          },
          () => onOrder(localMatch ?? null)
        );
      };

      if (!user) {
        subscribeTrackingFallback();
        return () => {
          fallbackUnsub?.();
        };
      }

      const orderRef = ref(db, `orders/${dbKey}`);
      const unsubscribe = onValue(
        orderRef,
        (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === "object" && "id" in val) {
            onOrder(val as Order);
          } else {
            subscribeTrackingFallback();
          }
        },
        () => {
          subscribeTrackingFallback();
        }
      );
      return () => {
        unsubscribe();
        fallbackUnsub?.();
      };
    } catch {
      onOrder(null);
      return () => {};
    }
  }, [user]);

  return (
    <OrdersContext.Provider value={{ orders, addOrder, updateOrder, watchOrderById }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error("useOrders must be used within OrdersProvider");
  return context;
}
