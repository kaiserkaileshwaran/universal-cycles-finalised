"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { subscribeUserToPush, unsubscribeUserFromPush, getActivePushSubscription } from "@/lib/push-helper";

interface PushNotificationSettingsProps {
  userId?: string;
  className?: string;
}

export function PushNotificationSettings({ userId, className = "" }: PushNotificationSettingsProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const checkStatus = async () => {
    if (typeof window === "undefined") return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setPermission(Notification.permission);
    const sub = await getActivePushSubscription();
    setIsSubscribed(Boolean(sub) && Notification.permission === "granted");
    setIsLoading(false);
  };

  useEffect(() => {
    checkStatus();

    const handleSubChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ subscribed: boolean }>;
      setIsSubscribed(Boolean(customEvent.detail?.subscribed));
      if (typeof window !== "undefined" && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    window.addEventListener("push-subscription-changed", handleSubChanged);
    return () => window.removeEventListener("push-subscription-changed", handleSubChanged);
  }, []);

  const handleToggle = async () => {
    if (isToggling || !isSupported) return;
    setIsToggling(true);
    setFeedback(null);

    try {
      if (!isSubscribed) {
        // Turning ON
        if (typeof window !== "undefined" && Notification.permission === "denied") {
          setPermission("denied");
          setFeedback({
            type: "error",
            message: "Notifications are blocked in your browser settings. Please allow notifications in your site settings to turn this on."
          });
          setIsToggling(false);
          return;
        }

        const res = await subscribeUserToPush(userId);
        if (res.success) {
          setIsSubscribed(true);
          setPermission("granted");
          setFeedback({
            type: "success",
            message: "Push notifications enabled! You'll now receive order and promotion updates."
          });
        } else {
          setFeedback({
            type: "error",
            message: res.error || "Could not enable push notifications."
          });
          setPermission(Notification.permission);
        }
      } else {
        // Turning OFF
        const res = await unsubscribeUserFromPush();
        if (res.success) {
          setIsSubscribed(false);
          setFeedback({
            type: "info",
            message: "Push notifications disabled."
          });
        } else {
          setFeedback({
            type: "error",
            message: res.error || "Could not unsubscribe."
          });
        }
      }
    } catch {
      setFeedback({
        type: "error",
        message: "An unexpected error occurred."
      });
    } finally {
      setIsToggling(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className={`bg-card border border-border shadow-sm rounded-3xl p-6 sm:p-8 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
            <Bell size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold">Push Notifications</h2>
              {!isLoading && (
                <>
                  {isSubscribed ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={13} /> Subscribed
                    </span>
                  ) : permission === "denied" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      <AlertCircle size={13} /> Blocked in Browser
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border">
                      Not Subscribed
                    </span>
                  )}
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Receive live order tracking, discount drops, and restock notifications
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
          <span className="text-sm font-semibold text-foreground">
            {isSubscribed ? "On" : "Off"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isSubscribed}
            aria-label="Toggle push notifications"
            disabled={isLoading || isToggling || !isSupported}
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              isSubscribed ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isSubscribed ? "translate-x-5" : "translate-x-0"
              }`}
            >
              {isToggling && <Loader2 size={12} className="animate-spin text-primary" />}
            </span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-muted/40 border border-border/60 p-4 text-sm text-muted-foreground leading-relaxed">
        {permission === "denied" ? (
          <div className="flex items-start gap-2.5 text-amber-600 dark:text-amber-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>
              Notifications are currently blocked by your browser permissions. To enable them, click the lock or settings icon in your browser URL bar, allow <strong>Notifications</strong>, and toggle this switch on.
            </p>
          </div>
        ) : !isSupported ? (
          <p>Push notifications are not supported on this browser or platform.</p>
        ) : isSubscribed ? (
          <p>
            You are actively subscribed to push notifications on this device. You will receive real-time updates for your orders, exclusive promotional drops, and price alerts.
          </p>
        ) : (
          <p>
            Turn on notifications to get instant alerts on this device whenever your order is shipped, delivered, or when special promotional sales begin.
          </p>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : feedback.type === "error"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              : "bg-muted text-muted-foreground border border-border"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
