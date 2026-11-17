"use client";

import { createContext, useContext, type ReactNode, type Dispatch, type SetStateAction, useMemo } from "react";

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

const INITIAL_BRANDS: Brand[] = [
  { id: "bmx-star", name: "BMX Star", slug: "bmx-star" },
  { id: "bsa", name: "BSA", slug: "bsa" },
  { id: "canyon", name: "Canyon", slug: "canyon" },
  { id: "firefox", name: "Firefox", slug: "firefox" },
  { id: "giant", name: "Giant", slug: "giant" },
  { id: "hercules", name: "Hercules", slug: "hercules" },
  { id: "hero", name: "Hero Cycles", slug: "hero-cycles" },
  { id: "specialized", name: "Specialized", slug: "specialized" },
  { id: "trek", name: "Trek", slug: "trek" },
];

interface BrandsContextValue {
  brands: Brand[];
  setBrands: Dispatch<SetStateAction<Brand[]>>;
}

const BrandsContext = createContext<BrandsContextValue | undefined>(undefined);

import { useFirebaseState } from "@/lib/use-firebase-state";

export function BrandsProvider({ children }: { children: ReactNode }) {
  const [rawBrands, setBrands] = useFirebaseState<Brand[]>("brands", INITIAL_BRANDS);

  // Normalize and strictly sort brands in alphabetical order (A to Z)
  const brands: Brand[] = useMemo(() => {
    const rawList: unknown[] = Array.isArray(rawBrands)
      ? rawBrands
      : (rawBrands && typeof rawBrands === "object" ? Object.values(rawBrands) : []);

    return rawList
      .map((item: unknown) => {
        const b = item as Partial<Brand>;
        return {
          id: String(b?.id || ""),
          name: String(b?.name || ""),
          slug: String(b?.slug || ""),
        };
      })
      .filter((b) => Boolean(b.name.trim()))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  }, [rawBrands]);

  return (
    <BrandsContext.Provider value={{ brands, setBrands }}>
      {children}
    </BrandsContext.Provider>
  );
}

export function useBrands() {
  const context = useContext(BrandsContext);
  if (!context) throw new Error("useBrands must be used within BrandsProvider");
  return context;
}
