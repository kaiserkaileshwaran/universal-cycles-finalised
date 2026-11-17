"use client";

import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { CATEGORIES as INITIAL_CATEGORIES } from "@/constants";

export type Subcategory = {
  id: string;
  name: string;
  slug: string;
  order?: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  order?: number;
  subcategories: Subcategory[];
};

interface CategoriesContextValue {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
  loaded: boolean;
}

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined);
import { useFirebaseState } from "@/lib/use-firebase-state";

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [rawCategories, setCategories, loaded] = useFirebaseState<Category[]>("categories", INITIAL_CATEGORIES);

  const rawList: unknown[] = Array.isArray(rawCategories)
    ? rawCategories
    : (rawCategories && typeof rawCategories === "object" ? Object.values(rawCategories) : []);

  const categories: Category[] = rawList
    .map((item: unknown, idx: number) => {
      const cat = item as Partial<Category> & { subcategories?: unknown };
      const rawSubs = cat?.subcategories;
      const subList: unknown[] = Array.isArray(rawSubs)
        ? rawSubs
        : (rawSubs && typeof rawSubs === "object" ? Object.values(rawSubs) : []);

      return {
        id: String(cat?.id || ""),
        name: String(cat?.name || ""),
        slug: String(cat?.slug || ""),
        description: String(cat?.description || ""),
        order: typeof cat?.order === "number" ? cat.order : idx,
        subcategories: subList.map((subItem: unknown, sIdx: number) => {
          const sub = subItem as Partial<Subcategory>;
          return {
            id: String(sub?.id || ""),
            name: String(sub?.name || ""),
            slug: String(sub?.slug || ""),
            order: typeof sub?.order === "number" ? sub.order : sIdx
          };
        }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      };
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return <CategoriesContext.Provider value={{ categories, setCategories, loaded }}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) throw new Error("useCategories must be used within CategoriesProvider");
  return context;
}
