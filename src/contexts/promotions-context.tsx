/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { COUPON_RULES } from "@/constants/promotions";
import { useFirebaseState } from "@/lib/use-firebase-state";
import { useAuth } from "@/contexts/auth-context";

export interface Promotion {
  id: string;
  code: string;
  kind: "percent" | "fixed" | "shipping";
  value: number;
  minimum: number;
  isPublic: boolean;
  isActive: boolean;
  description: string;
}

function formatPromoDescription(kind: Promotion["kind"], value: number, rawDesc?: string): string {
  if (rawDesc && typeof rawDesc === "string" && !rawDesc.includes("${") && rawDesc.trim().length > 0) {
    return rawDesc.trim();
  }
  if (kind === "percent") return `${value}% off`;
  if (kind === "shipping") return "Free shipping";
  return `₹${value} off`;
}

export function isPromotionEligible(promo: Promotion, subtotal: number): boolean {
  if (!promo || !promo.isActive || subtotal <= 0) return false;
  if (subtotal < (promo.minimum || 0)) return false;
  if (promo.kind === "fixed" && promo.value > subtotal) return false;
  return true;
}

export function getPromotionValueLabel(promo: Pick<Promotion, "kind" | "value">): string {
  const val = Number(promo.value) || 0;
  if (promo.kind === "shipping") return "Free standard shipping";
  if (promo.kind === "fixed") return `Overall ₹${val.toLocaleString("en-IN")} off`;
  return `Overall ${val}% off`;
}

const INITIAL_PROMOTIONS: Promotion[] = Object.entries(COUPON_RULES).map(([code, rule]) => ({
  id: code,
  code,
  kind: rule.kind as any,
  value: rule.value,
  minimum: rule.minimum,
  isPublic: true,
  isActive: true,
  description: formatPromoDescription(rule.kind as Promotion["kind"], rule.value),
}));

interface PromotionsContextValue {
  promotions: Promotion[];
  setPromotions: Dispatch<SetStateAction<Promotion[]>>;
  getDiscount: (code: string | undefined, subtotal: number) => number;
}

const PromotionsContext = createContext<PromotionsContextValue | undefined>(undefined);

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const [rawPromotions, setPromotions] = useFirebaseState<Promotion[]>("promotions", INITIAL_PROMOTIONS);
  const { user } = useAuth();

  const promotions = useMemo<Promotion[]>(() => {
    const list: unknown[] = Array.isArray(rawPromotions)
      ? rawPromotions
      : rawPromotions && typeof rawPromotions === "object"
      ? Object.values(rawPromotions)
      : [];
    return list
      .filter((item): item is Partial<Promotion> => Boolean(item && typeof item === "object" && (item as Promotion).code))
      .map((item) => {
        const kind: Promotion["kind"] =
          item.kind === "percent" || item.kind === "fixed" || item.kind === "shipping" ? item.kind : "percent";
        const value = Number(item.value ?? 0);
        const minimum = Number(item.minimum ?? 0);
        const code = String(item.code || "").trim().toUpperCase();
        return {
          id: item.id && !String(item.id).includes("${") ? String(item.id) : code,
          code,
          kind,
          value,
          minimum,
          isPublic: item.isPublic !== false,
          isActive: item.isActive !== false,
          description: formatPromoDescription(kind, value, item.description),
        };
      });
  }, [rawPromotions]);

  useEffect(() => {
    if (user?.email?.toLowerCase() !== "admin@gmail.com") return;
    const rawStr = JSON.stringify(rawPromotions || []);
    if (rawStr.includes("${") && promotions.length > 0) {
      setPromotions(promotions);
    }
  }, [user, rawPromotions, promotions, setPromotions]);

  const getDiscount = (code: string | undefined, subtotal: number) => {
    if (!code || subtotal <= 0) return 0;
    const promo = promotions.find((p) => p.code.toLowerCase() === code.toLowerCase() && p.isActive);
    if (!promo || subtotal < promo.minimum) return 0;
    if (promo.kind === "percent") return Math.min(subtotal, Math.round(subtotal * (promo.value / 100)));
    if (promo.kind === "fixed") return Math.min(subtotal, Math.round(promo.value));
    return 0;
  };

  return (
    <PromotionsContext.Provider value={{ promotions, setPromotions, getDiscount }}>
      {children}
    </PromotionsContext.Provider>
  );
}

export function usePromotions() {
  const context = useContext(PromotionsContext);
  if (!context) throw new Error("usePromotions must be used within PromotionsProvider");
  return context;
}
