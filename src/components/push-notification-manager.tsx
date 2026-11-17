"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { subscribeUserToPush, getActivePushSubscription, getCustomerInterests } from "@/lib/push-helper";
import { runWhenInteractive } from "@/firebase/firebase";
import { useCart } from "@/contexts/cart-context";
import { useProducts } from "@/contexts/products-context";

export function PushNotificationManager() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { state: cartState } = useCart();
  const { products } = useProducts();

  const dismiss = useCallback(() => {
    setShowPrompt(false);
  }, []);

  // 1. Unfinished / Abandoned Cart Push Notification Reminder
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (!cartState.items || cartState.items.length === 0) return;

    const CART_REMINDER_KEY = "universal_cycles_last_cart_reminder";
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        const currentTime = Date.now();
        const prevReminder = Number(localStorage.getItem(CART_REMINDER_KEY) || 0);
        if (currentTime - prevReminder > FOUR_HOURS_MS) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const firstItem = cartState.items[0];
            const itemName = firstItem.product?.name || "cycle";
            const extra = cartState.items.length > 1 ? ` and ${cartState.items.length - 1} more item(s)` : "";
            reg.showNotification("🛒 You left items in your cart!", {
              body: `Your ${itemName}${extra} is waiting for you! Complete your order before stocks run out.`,
              icon: "/cycle.png",
              badge: "/icon.svg",
              data: { url: "/cart" },
              tag: "universal-abandoned-cart",
            });
            localStorage.setItem(CART_REMINDER_KEY, String(currentTime));
          } catch (e) {
            console.error("Cart reminder error:", e);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [cartState.items]);

  // 2. Smart Interest-based Recommendations Follow-Up
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (products.length === 0) return;

    const INTEREST_REMINDER_KEY = "universal_cycles_last_interest_reminder";
    const lastReminder = Number(localStorage.getItem(INTEREST_REMINDER_KEY) || 0);
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const now = Date.now();

    if (now - lastReminder < TWELVE_HOURS_MS) return;

    const interests = getCustomerInterests();
    if (interests.length === 0) return;

    // Find an active product matching the customer's top search/category interests
    const matched = products.find((p) =>
      p.isActive &&
      interests.some((term) =>
        p.name.toLowerCase().includes(term) ||
        p.categoryId?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term) ||
        p.tags?.some((t) => t.toLowerCase().includes(term))
      )
    );

    if (matched) {
      const timer = setTimeout(async () => {
        try {
          const reg = await navigator.serviceWorker.ready;
          const matchedTerm = interests.find((term) =>
            matched.name.toLowerCase().includes(term) ||
            matched.categoryId?.toLowerCase().includes(term) ||
            matched.brand?.toLowerCase().includes(term)
          ) || "your favorites";

          reg.showNotification(`🚲 Matches your search for "${matchedTerm}"`, {
            body: `Discover ${matched.name} now in stock at Universal Cycles. Tap to explore!`,
            icon: matched.thumbnail || "/cycle.png",
            badge: "/icon.svg",
            data: { url: `/products/${matched.id}` },
            tag: `universal-interest-${matched.id}`,
          });
          localStorage.setItem(INTEREST_REMINDER_KEY, String(Date.now()));
        } catch (e) {
          console.error("Interest notification error:", e);
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [products]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    const init = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (err) {
        console.error("SW registration error:", err);
      }

      if (Notification.permission === 'granted') {
        const sub = await getActivePushSubscription();
        if (sub) return;
      }
    };

    const cancelInit = runWhenInteractive(init);

    // Listen for subscription changes from Profile page
    const handleSubscriptionChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ subscribed: boolean }>;
      if (customEvent.detail?.subscribed) {
        setShowPrompt(false);
      }
    };

    window.addEventListener("push-subscription-changed", handleSubscriptionChanged);

    return () => {
      cancelInit();
      window.removeEventListener("push-subscription-changed", handleSubscriptionChanged);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPrompt) {
        dismiss();
      }
    };
    if (showPrompt) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showPrompt, dismiss]);

  const subscribe = async () => {
    setIsSubscribing(true);
    try {
      await subscribeUserToPush();
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    } finally {
      setIsSubscribing(false);
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-notify-title"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 text-center shadow-2xl sm:p-8"
          >
            {/* Subtle ambient glow decoration */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />

            {/* Close Button */}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close dialog"
              className="absolute top-4 right-4 z-20 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={20} />
            </button>

            {/* Icon Badge */}
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
              <Bell size={30} className="stroke-[2.25]" />
            </div>

            {/* Heading & Description */}
            <h3 id="push-notify-title" className="text-2xl font-bold tracking-tight text-foreground">
              Stay in the Loop
            </h3>
            <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-muted-foreground">
              Enable push notifications to receive real-time order tracking updates, new bike arrivals, and exclusive seasonal promotions.
            </p>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={subscribe}
                disabled={isSubscribing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-5 text-base font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70"
              >
                <Bell size={18} /> {isSubscribing ? "Enabling..." : "Enable Notifications"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 py-3.5 px-5 text-base font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

