import { getFirebaseDatabase, isFirebaseConfigured, getFirebaseAuth } from "@/firebase/firebase";
import { ref, get, set, update, remove } from "firebase/database";

// Public half of the VAPID key pair. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY (the matching private key lives only in VAPID_PRIVATE_KEY on the server).
export const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getSubscriptionId(endpoint: string) {
  return btoa(endpoint || "").replace(/[^a-zA-Z0-9]/g, "").slice(-30);
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.error("Error getting push subscription:", err);
    return null;
  }
}

export const CUSTOMER_INTERESTS_KEY = "universal_cycles_customer_interests";

export function getCustomerInterests(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOMER_INTERESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordCustomerInterest(interest: string): Promise<void> {
  if (typeof window === "undefined" || !interest) return;
  const term = interest.toLowerCase().trim();
  if (term.length < 2) return;

  try {
    const current = getCustomerInterests();
    const updated = [term, ...current.filter((i) => i !== term)].slice(0, 15);
    localStorage.setItem(CUSTOMER_INTERESTS_KEY, JSON.stringify(updated));

    // If an active push subscription exists, sync interests to Firebase RTDB for smart targeting
    const sub = await getActivePushSubscription();
    if (sub) {
      const subJson = sub.toJSON();
      const subId = getSubscriptionId(subJson.endpoint || "");
      if (subId && subJson.endpoint) {
        const dbRef = ref(getFirebaseDatabase(), `push_subscriptions/${subId}`);
        await update(dbRef, {
          endpoint: subJson.endpoint,
          interests: updated,
          updatedAt: Date.now()
        });
      }
    }
  } catch (err) {
    console.error("Failed to record customer interest:", err);
  }
}

export async function subscribeUserToPush(userId?: string): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined" || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: "Push notifications are not supported on this browser." };
  }

  if (!PUBLIC_VAPID_KEY) {
    return { success: false, error: "Push notifications are not set up for this site yet." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { 
        success: false, 
        error: permission === 'denied' 
          ? "Notification permission was blocked in your browser settings." 
          : "Notification permission was dismissed." 
      };
    }

    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;
    
    let subscription = await registration.pushManager.getSubscription();
    // A subscription made with an older VAPID key can never receive messages signed with the current one, so replace it.
    if (subscription?.options.applicationServerKey) {
      const current = new Uint8Array(subscription.options.applicationServerKey);
      const expected = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
      if (current.length !== expected.length || current.some((byte, index) => byte !== expected[index])) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });
    }

    const subJson = subscription.toJSON();
    const subId = getSubscriptionId(subJson.endpoint || "");
    const interests = getCustomerInterests();
    
    try {
      const dbRef = ref(getFirebaseDatabase(), `push_subscriptions/${subId}`);
      await set(dbRef, {
        ...subJson,
        userId: userId || null,
        interests,
        updatedAt: Date.now()
      });
    } catch (dbError) {
      console.error("Firebase write error:", dbError);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("push-subscription-changed", { detail: { subscribed: true } }));
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to subscribe:", err);
    return { success: false, error: (err as Error).message || "Failed to subscribe" };
  }
}

export async function unsubscribeUserFromPush(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined" || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: "Push notifications are not supported on this browser." };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const subJson = subscription.toJSON();
      const subId = getSubscriptionId(subJson.endpoint || "");
      await subscription.unsubscribe();

      try {
        if (subId && subJson.endpoint) {
          const dbRef = ref(getFirebaseDatabase(), `push_subscriptions/${subId}`);
          await update(dbRef, {
            endpoint: subJson.endpoint,
            disabled: true,
            keys: null,
            updatedAt: Date.now()
          });
        }
      } catch (dbError) {
        console.error("Firebase unsubscribe update error:", dbError);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("push-subscription-changed", { detail: { subscribed: false } }));
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to unsubscribe:", err);
    return { success: false, error: (err as Error).message || "Failed to unsubscribe" };
  }
}

export interface PushTargetInfo {
  productName?: string;
  category?: string;
  brand?: string;
  tags?: string[];
}

export async function sendPushNotification(
  title: string,
  body: string,
  url: string,
  targetInfo?: PushTargetInfo
) {
  try {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;
    // push_subscriptions read is restricted by security rules to admin@gmail.com
    if (currentUser?.email?.toLowerCase() !== "admin@gmail.com") {
      return;
    }
    const dbRef = ref(getFirebaseDatabase(), "push_subscriptions");
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      const subsObj = snapshot.val();
      const subscriptions = Object.values(subsObj);
      
      if (subscriptions.length > 0) {
        const idToken = await currentUser.getIdToken();
        await fetch("/api/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            title,
            body,
            url,
            subscriptions,
            targetInfo
          })
        });
      }
    }
  } catch (error) {
    console.error("Failed to trigger push notification", error);
  }
}

export const STOCK_ALERTS_KEY = "universal_cycles_stock_alerts";

export function isSubscribedToStockAlert(productId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STOCK_ALERTS_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(productId);
  } catch {
    return false;
  }
}

export async function subscribeToStockAlert(productId: string): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined") return { success: false, error: "Window is undefined" };

  try {
    const subRes = await subscribeUserToPush();
    if (!subRes.success) {
      return subRes;
    }

    const sub = await getActivePushSubscription();
    if (!sub) {
      return { success: false, error: "No active push subscription found" };
    }

    const subJson = sub.toJSON();
    const subId = getSubscriptionId(subJson.endpoint || "");
    if (!subId) {
      return { success: false, error: "Failed to generate subscription ID" };
    }

    // Save stock alert subscription in Firebase RTDB
    const dbRef = ref(getFirebaseDatabase(), `stock_alerts/${productId}/${subId}`);
    await set(dbRef, {
      ...subJson,
      productId,
      subscribedAt: Date.now()
    });

    // Save locally
    try {
      const raw = localStorage.getItem(STOCK_ALERTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!list.includes(productId)) {
        localStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify([...list, productId]));
      }
    } catch {}

    return { success: true };
  } catch (err) {
    console.error("Failed to subscribe to stock alert:", err);
    return { success: false, error: (err as Error).message || "Failed to subscribe" };
  }
}

export async function sendStockRestockNotification(productId: string, productName: string) {
  try {
    // 1. Check if customers specifically signed up for restock alert on this cycle
    const alertsRef = ref(getFirebaseDatabase(), `stock_alerts/${productId}`);
    const snapshot = await get(alertsRef);
    if (snapshot.exists()) {
      const subsObj = snapshot.val();
      const specificSubs = Object.values(subsObj);
      if (specificSubs.length > 0) {
        const currentUser = getFirebaseAuth()?.currentUser;
        const idToken = currentUser ? await currentUser.getIdToken() : "";
        await fetch("/api/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            title: `🚲 Back in Stock: ${productName}!`,
            body: `Great news! The ${productName} is back in stock at Universal Cycles. Order yours now before it sells out!`,
            url: `/products/${productId}`,
            subscriptions: specificSubs
          })
        });
        // Remove fulfilled alerts from Firebase
        await remove(alertsRef);
      }
    }

    // 2. Also notify general subscribers who have search/category interest in this cycle
    await sendPushNotification(
      `Back in Stock: ${productName}! 🚲`,
      `The popular ${productName} has just been restocked at Universal Cycles. Tap to explore!`,
      `/products/${productId}`,
      { productName }
    );
  } catch (error) {
    console.error("Failed to send restock notification:", error);
  }
}

export function getOwnerStockAlertWhatsAppLink(
  productName: string,
  stock: number,
  rawPhone: string,
  orderId?: string
): string {
  const phone = (rawPhone || "").replace(/\D/g, "");
  const formattedPhone = phone.startsWith("91") ? phone : phone.length === 10 ? `91${phone}` : phone;
  const statusText = stock === 0 ? "🚨 OUT OF STOCK" : `⚠️ LOW STOCK (${stock} REMAINING)`;
  const orderText = orderId ? `\nTriggered by: Order #${orderId}` : "";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://universalcycles.com";

  const message = `🔔 *UNIVERSAL CYCLES INVENTORY ALERT*\n\n` +
    `Product: *${productName}*\n` +
    `Status: *${statusText}*\n` +
    `Remaining Stock: *${stock} units*${orderText}\n\n` +
    `👉 Manage & Restock in Admin:\n${siteUrl}/admin/products`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

export function getOwnerConsolidatedStockAlertWhatsAppLink(
  outOfStock: Array<{ name: string }>,
  lowStock: Array<{ name: string; stock: number }>,
  rawPhone: string
): string {
  const phone = (rawPhone || "").replace(/\D/g, "");
  const formattedPhone = phone.startsWith("91") ? phone : phone.length === 10 ? `91${phone}` : phone;
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://universalcycles.com";

  let body = `🚨 *UNIVERSAL CYCLES INVENTORY REPORT* 🚨\n\n`;

  if (outOfStock.length > 0) {
    body += `*❌ Out of Stock (${outOfStock.length} items):*\n`;
    outOfStock.forEach((p) => {
      body += `• ${p.name}\n`;
    });
    body += `\n`;
  }

  if (lowStock.length > 0) {
    body += `*⚠️ Low Stock (${lowStock.length} items):*\n`;
    lowStock.forEach((p) => {
      body += `• ${p.name} (${p.stock} left)\n`;
    });
    body += `\n`;
  }

  body += `⚡ *Action Required:* Please restock these cycles to prevent missed orders:\n${siteUrl}/admin/products`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(body)}`;
}
