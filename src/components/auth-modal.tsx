"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

// Singleton event emitter for auth requests
type AuthRequestEvent = CustomEvent<{ title: string; subtitle: string }>;

export function requestAuth(title: string, subtitle: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trigger-auth-modal", { detail: { title, subtitle } }));
  }
}

export function AuthNotificationAndModal() {
  const { user, loading } = useAuth();
  
  const [showNotification, setShowNotification] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "Sign in required", subtitle: "Please sign in to continue." });

  const dismissNotification = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("auth_modal_active");
      window.dispatchEvent(new CustomEvent("auth-modal-visibility", { detail: { open: false } }));
    }
    setShowNotification(false);
  }, []);

  const closeModal = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("auth_modal_active");
      window.dispatchEvent(new CustomEvent("auth-modal-visibility", { detail: { open: false } }));
    }
    setShowModal(false);
  }, []);

  // Listen for manual auth triggers (Wishlist)
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as AuthRequestEvent;
      setModalContent(customEvent.detail);
      sessionStorage.setItem("auth_modal_active", "true");
      window.dispatchEvent(new CustomEvent("auth-modal-visibility", { detail: { open: true } }));
      setShowModal(true);
      setShowNotification(false);
    };
    window.addEventListener("trigger-auth-modal", handler);
    return () => window.removeEventListener("trigger-auth-modal", handler);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNotification) dismissNotification();
        if (showModal) closeModal();
      }
    };
    if (showNotification || showModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showNotification, showModal, dismissNotification, closeModal]);

  if (loading) return null;

  return (
    <>
      {/* Centered Modal for Logged Out User on initial visit */}
      <AnimatePresence>
        {showNotification && !user && !showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissNotification}
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
              aria-labelledby="auth-notify-title"
              className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 text-center shadow-2xl sm:p-8"
            >
              {/* Subtle ambient glow decoration */}
              <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />

              {/* Close Button */}
              <button
                type="button"
                onClick={dismissNotification}
                aria-label="Close dialog"
                className="absolute top-4 right-4 z-20 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={20} />
              </button>

              {/* Icon Badge */}
              <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
                <Lock size={30} className="stroke-[2.25]" />
              </div>

              {/* Heading & Subtitle */}
              <h3 id="auth-notify-title" className="text-2xl font-bold tracking-tight text-foreground">
                You&apos;re Signed Out
              </h3>
              <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-muted-foreground">
                Sign in to your account to save your favorite cycles to your wishlist, track live order status, and complete fast checkouts.
              </p>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/login"
                  onClick={dismissNotification}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-5 text-base font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <LogIn size={18} /> Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={dismissNotification}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 py-3.5 px-5 text-base font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
                >
                  <UserPlus size={18} /> Create Account
                </Link>
                <button
                  type="button"
                  onClick={dismissNotification}
                  className="pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4"
                >
                  Continue browsing as guest
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Block Modal (when clicking Wishlist or Buy Now) */}
      <AnimatePresence>
        {showModal && !user && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
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
              aria-labelledby="auth-modal-title"
              className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 text-center shadow-2xl sm:p-8"
            >
              {/* Subtle ambient glow decoration */}
              <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />

              {/* Close Button */}
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close dialog"
                className="absolute top-4 right-4 z-20 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
              
              {/* Icon Badge */}
              <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
                <Lock size={30} className="stroke-[2.25]" />
              </div>
              
              {/* Title & Subtitle */}
              <h2 id="auth-modal-title" className="text-2xl font-bold tracking-tight text-foreground">
                {modalContent.title}
              </h2>
              <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-muted-foreground">
                {modalContent.subtitle}
              </p>
              
              {/* Action Buttons */}
              <div className="mt-6 flex flex-col gap-3">
                <Link 
                  href="/login" 
                  onClick={closeModal}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-5 text-base font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <LogIn size={18} /> Sign In
                </Link>
                <Link 
                  href="/register" 
                  onClick={closeModal}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 py-3.5 px-5 text-base font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
                >
                  <UserPlus size={18} /> Create Account
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

