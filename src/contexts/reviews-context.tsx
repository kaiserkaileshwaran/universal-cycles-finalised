"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onValue, ref, remove, set, update } from "firebase/database";
import { getFirebaseDatabase, isFirebaseConfigured, runWhenInteractive } from "@/firebase/firebase";
import { sanitizeForFirebase } from "@/lib/use-firebase-state";
import type { Review } from "@/types";

type ReviewDraft = Omit<Review, "id" | "createdAt" | "helpful" | "status" | "isVerified"> & {
  status?: Review["status"];
  isVerified?: boolean;
};

interface ReviewsValue {
  reviews: Review[];
  addReview: (draft: ReviewDraft) => void;
  markHelpful: (reviewId: string) => void;
  deleteReview: (reviewId: string) => void;
  updateReview: (reviewId: string, updates: Partial<Review>) => void;
}

const ReviewsContext = createContext<ReviewsValue | undefined>(undefined);

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let unsubscribe: (() => void) | undefined;
    const cancelInteractive = runWhenInteractive(() => {
      try {
        const db = getFirebaseDatabase();
        unsubscribe = onValue(
          ref(db, "reviews"),
          (snapshot) => {
            const val = snapshot.val();
            if (!val || typeof val !== "object") {
              setReviews((prev) => (prev.length === 0 ? prev : []));
              return;
            }
            const list = (Array.isArray(val) ? val : Object.values(val)).filter(
              (r): r is Review => Boolean(r && typeof r === "object" && "id" in r)
            );
            const sorted = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setReviews((prev) => (JSON.stringify(prev) === JSON.stringify(sorted) ? prev : sorted));
          },
          () => {}
        );
      } catch {
        // Ignore connection error
      }
    });
    return () => {
      cancelInteractive();
      unsubscribe?.();
    };
  }, []);

  const addReview = useCallback((draft: ReviewDraft) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const review: Review = {
      ...draft,
      comment: (draft.comment || "").trim().slice(0, 1500),
      id,
      createdAt: Date.now(),
      helpful: 0,
      status: draft.status || "pending",
      isVerified: draft.isVerified || false,
    };
    setReviews((current) => [review, ...current]);
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseDatabase();
        set(ref(db, `reviews/${review.id}`), sanitizeForFirebase(review)).catch(() => {});
      } catch {}
    }
  }, []);

  const markHelpful = useCallback((reviewId: string) => {
    setReviews((current) => {
      const target = current.find((r) => r.id === reviewId);
      const nextHelpful = (target?.helpful || 0) + 1;
      if (isFirebaseConfigured() && target) {
        try {
          const db = getFirebaseDatabase();
          update(ref(db, `reviews/${reviewId}`), { helpful: nextHelpful }).catch(() => {});
        } catch {}
      }
      return current.map((r) => (r.id === reviewId ? { ...r, helpful: nextHelpful } : r));
    });
  }, []);

  const deleteReview = useCallback((reviewId: string) => {
    setReviews((current) => current.filter((r) => r.id !== reviewId));
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseDatabase();
        remove(ref(db, `reviews/${reviewId}`)).catch(() => {});
      } catch {}
    }
  }, []);

  const updateReview = useCallback((reviewId: string, updates: Partial<Review>) => {
    setReviews((current) => current.map((r) => (r.id === reviewId ? { ...r, ...updates } : r)));
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseDatabase();
        update(
          ref(db, `reviews/${reviewId}`),
          sanitizeForFirebase(updates) as Record<string, unknown>
        ).catch(() => {});
      } catch {}
    }
  }, []);

  return (
    <ReviewsContext.Provider value={{ reviews, addReview, markHelpful, deleteReview, updateReview }}>
      {children}
    </ReviewsContext.Provider>
  );
}

export function useReviews() {
  const context = useContext(ReviewsContext);
  if (!context) throw new Error("useReviews must be used within ReviewsProvider");
  return context;
}
