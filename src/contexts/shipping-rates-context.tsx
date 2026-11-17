"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { ref, set, remove } from "firebase/database";
import { getFirebaseDatabase, isFirebaseConfigured } from "@/firebase/firebase";
import { useFirebaseState } from "@/lib/use-firebase-state";
import { rateKey } from "@/lib/shipping";

// state -> district -> delivery fee in rupees
export type ShippingRateBook = Record<string, Record<string, number>>;

interface ShippingRatesValue {
  rates: ShippingRateBook;
  ready: boolean;
  getRate: (state: string, district: string) => number | undefined;
  countForState: (state: string) => number;
  setRate: (state: string, district: string, fee: number | null) => Promise<void>;
}

const EMPTY_BOOK: ShippingRateBook = {};
const ShippingRatesContext = createContext<ShippingRatesValue | undefined>(undefined);

export function ShippingRatesProvider({ children }: { children: ReactNode }) {
  const [book, , ready] = useFirebaseState<ShippingRateBook>("shipping_rates", EMPTY_BOOK);
  const rates = book && typeof book === "object" ? book : EMPTY_BOOK;

  const getRate = useCallback((state: string, district: string) => {
    if (!state || !district) return undefined;
    const value = rates[rateKey(state)]?.[rateKey(district)];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  }, [rates]);

  const countForState = useCallback((state: string) => Object.keys(rates[rateKey(state)] ?? {}).length, [rates]);

  const setRate = useCallback(async (state: string, district: string, fee: number | null) => {
    if (!isFirebaseConfigured()) throw new Error("Firebase is not configured.");
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) throw new Error("Enter a delivery fee of 0 or more.");
    const leaf = ref(getFirebaseDatabase(), `shipping_rates/${rateKey(state)}/${rateKey(district)}`);
    // Write only this one district so concurrent edits never overwrite other rates.
    if (fee === null) await remove(leaf);
    else await set(leaf, Math.round(fee));
  }, []);

  return <ShippingRatesContext.Provider value={{ rates, ready, getRate, countForState, setRate }}>{children}</ShippingRatesContext.Provider>;
}

export function useShippingRates() {
  const context = useContext(ShippingRatesContext);
  if (!context) throw new Error("useShippingRates must be used within ShippingRatesProvider");
  return context;
}
