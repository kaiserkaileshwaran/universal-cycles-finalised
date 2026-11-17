import type { Product } from "@/types";

export interface ShippingFeeInput {
  /** Fee the cart already computed for standard delivery: 0 when the order ships free, else the store default. */
  cartStandardFee: number;
  /** Admin-configured standard fee for the customer's district, if any. With "by weight" on this is a fee per kg. */
  districtRate?: number;
  /** When true, the district rate is multiplied by the total cart weight. */
  byWeight?: boolean;
  cartWeightKg?: number;
  storeRates: { standardShippingFee: number; expressShippingFee: number; overnightShippingFee: number };
}

/** A product with no weight set counts as this many kg, so a missing weight never makes shipping free. */
export const DEFAULT_WEIGHT_KG = 1;

/** Weight of one unit in kg from the weight field or a "Weight: 14.2 kg" spec, or undefined when neither is set. */
export function knownProductWeightKg(product: Pick<Product, "weightKg" | "specifications">): number | undefined {
  if (typeof product.weightKg === "number" && Number.isFinite(product.weightKg) && product.weightKg > 0) return product.weightKg;
  const spec = Object.entries(product.specifications ?? {}).find(([key]) => key.trim().toLowerCase() === "weight")?.[1];
  const match = typeof spec === "string" ? spec.match(/(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|g|grams?)\b/i) : null;
  if (match) {
    const value = Number(match[1]);
    const kg = /^k/i.test(match[2]) ? value : value / 1000;
    if (kg > 0) return kg;
  }
  return undefined;
}

/** Weight of one unit in kg, falling back to DEFAULT_WEIGHT_KG when unknown. */
export function productWeightKg(product: Pick<Product, "weightKg" | "specifications">): number {
  return knownProductWeightKg(product) ?? DEFAULT_WEIGHT_KG;
}

/** Total shipping weight of cart lines in kg. */
export function cartWeightKg(items: { product: Pick<Product, "weightKg" | "specifications">; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + productWeightKg(item.product) * item.quantity, 0);
}

/**
 * Standard uses the district fee (unless the order ships free); with "by weight" on, that fee is per kg of cart weight.
 * Express and Priority keep their usual surcharge over standard, so a more expensive district raises them by the same amount.
 * Areas with no district rate keep the store's flat default fee.
 */
export function computeShippingFees({ cartStandardFee, districtRate, byWeight = false, cartWeightKg = 0, storeRates }: ShippingFeeInput) {
  const districtFee = districtRate === undefined ? undefined : byWeight ? Math.round(districtRate * cartWeightKg) : districtRate;
  const delta = districtFee !== undefined ? districtFee - storeRates.standardShippingFee : 0;
  return {
    standard: cartStandardFee === 0 ? 0 : (districtFee ?? cartStandardFee),
    express: Math.max(0, storeRates.expressShippingFee + delta),
    overnight: Math.max(0, storeRates.overnightShippingFee + delta),
  };
}

// Realtime Database keys cannot contain . $ # [ ] /
export const rateKey = (name: string) => name.replace(/[.$#[\]/]/g, "_");

export const MAX_FREE_SHIPPING_MINIMUM = 10_000_000;

/** Validates the admin's "free delivery on orders of ₹X or more" input. 0 means every order ships free. */
export function parseFreeShippingMinimum(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.replace(/[,₹\s]/g, "");
  if (text === "") return { ok: false, error: "Enter an amount, for example 50000. Enter 0 to make delivery free on every order." };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: "Enter the amount as a plain number, for example 50000." };
  const value = Math.round(Number(text));
  if (value > MAX_FREE_SHIPPING_MINIMUM) return { ok: false, error: "That amount is too large. Enter a value up to 1,00,00,000." };
  return { ok: true, value };
}
