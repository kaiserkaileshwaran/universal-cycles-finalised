"use client";

import { createContext, useCallback, useContext, type ReactNode, useState, useEffect } from "react";
import { onValue, ref, set } from "firebase/database";
import { getFirebaseDatabase, isFirebaseConfigured } from "@/firebase/firebase";
import { useAuth } from "@/contexts/auth-context";
import { sanitizeForFirebase, useFirebaseState } from "@/lib/use-firebase-state";

export type PrizeType = "coupon" | "discount" | "product" | "gift" | "points";
export interface Prize {
  id: string;
  label: string;
  type: PrizeType;
  value: string;
  probability: number;
  color: string;
  enabled: boolean;
}
export interface SpinWinner {
  id: string;
  user: string;
  email: string;
  prize: string;
  rewardCode?: string;
  date: string;
}

export const INITIAL_PRIZES: Prize[] = [
  { id: "1", label: "10% OFF", type: "coupon", value: "WELCOME10", probability: 30, color: "#2D6A4F", enabled: true },
  { id: "2", label: "Free Shipping", type: "coupon", value: "FREESHIP", probability: 10, color: "#F4A261", enabled: true },
  { id: "3", label: "₹2,000 OFF", type: "coupon", value: "CYCLE20", probability: 10, color: "#1B4332", enabled: true },
  { id: "4", label: "Try Again", type: "gift", value: "", probability: 25, color: "#95D5B2", enabled: true },
  { id: "5", label: "500 Reward Points", type: "points", value: "500", probability: 10, color: "#40916C", enabled: true },
  { id: "6", label: "25% OFF", type: "coupon", value: "WHEEL25", probability: 10, color: "#B7E4C7", enabled: true },
  { id: "7", label: "₹500 OFF", type: "coupon", value: "FIVE5", probability: 5, color: "#74C69D", enabled: true },
];

const SPIN_DAILY_STORAGE_KEY = "uc_spin_daily_v1";

interface SpinContextValue {
  prizes: Prize[];
  winners: SpinWinner[];
  hasSpunToday: (userId: string) => boolean;
  savePrizes: (prizes: Prize[]) => void;
  recordWin: (userId: string, email: string, prize: Prize) => void;
  ready: boolean;
}

const SpinContext = createContext<SpinContextValue | undefined>(undefined);

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function SpinWheelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === "admin@gmail.com";
  const [prizes, setPrizes, prizesReady] = useFirebaseState<Prize[]>("spin_prizes", INITIAL_PRIZES);
  const [winners, setWinners] = useState<SpinWinner[]>([]);
  const [dailySpins, setDailySpins] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isFirebaseConfigured() || !isAdmin) return;
    try {
      const db = getFirebaseDatabase();
      const unsub = onValue(
        ref(db, "spin_winners"),
        (snapshot) => {
          const data = snapshot.val();
          if (data && typeof data === "object") {
            const list = Array.isArray(data) ? data : Object.values(data);
            setWinners(list as SpinWinner[]);
          } else {
            setWinners([]);
          }
        },
        () => {}
      );
      return () => unsub();
    } catch {
      return;
    }
  }, [isAdmin]);

  // Hydrate daily spins from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SPIN_DAILY_STORAGE_KEY);
      if (stored) {
        setDailySpins(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const hasSpunToday = useCallback((userId: string) => dailySpins[userId] === localDate(), [dailySpins]);

  const savePrizes = useCallback((nextPrizes: Prize[]) => {
    setPrizes(nextPrizes);
  }, [setPrizes]);

  const recordWin = useCallback((userId: string, email: string, prize: Prize) => {
    const today = localDate();
    const updatedDaily = { ...dailySpins, [userId]: today };
    setDailySpins(updatedDaily);
    try {
      localStorage.setItem(SPIN_DAILY_STORAGE_KEY, JSON.stringify(updatedDaily));
    } catch {}

    const newWinner: SpinWinner = {
      id: `w${Date.now()}`,
      user: email || "Customer",
      email,
      prize: prize.label,
      rewardCode: prize.type === "coupon" ? prize.value : undefined,
      date: new Date().toISOString(),
    };
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseDatabase();
        set(ref(db, `spin_winners/${newWinner.id}`), sanitizeForFirebase(newWinner)).catch(() => {});
      } catch {}
    }
    setWinners((current) => [newWinner, ...(current || [])]);
  }, [dailySpins]);

  return (
    <SpinContext.Provider
      value={{
        prizes: prizes || INITIAL_PRIZES,
        winners: winners || [],
        hasSpunToday,
        savePrizes,
        recordWin,
        ready: prizesReady,
      }}
    >
      {children}
    </SpinContext.Provider>
  );
}

export function useSpinWheel() {
  const context = useContext(SpinContext);
  if (!context) throw new Error("useSpinWheel must be used within SpinWheelProvider");
  return context;
}
