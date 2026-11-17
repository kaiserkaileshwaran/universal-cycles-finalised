"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-context";

interface WishlistContextType {
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<string[]>([]);
  const [ready, setReady] = useState(true);

  // Load wishlist for current user on mount or auth change
  useEffect(() => {
    if (!user) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    try {
      const storageKey = `universal_cycles_wishlist_${user.uid}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load wishlist", e);
    } finally {
      setReady(true);
    }
  }, [user]);

  // Persist wishlist whenever items change
  useEffect(() => {
    if (!user || !ready) return;
    try {
      const storageKey = `universal_cycles_wishlist_${user.uid}`;
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save wishlist", e);
    }
  }, [items, user, ready]);

  const toggleWishlist = (productId: string) => {
    if (!user) return; // Only allow if logged in
    
    setItems((prev) => {
      const updated = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      return updated;
    });
  };

  const isWishlisted = (productId: string) => items.includes(productId);
  const clearWishlist = () => {
    setItems([]);
    if (user) {
      try {
        localStorage.removeItem(`universal_cycles_wishlist_${user.uid}`);
      } catch {}
    }
  };

  return (
    <WishlistContext.Provider
      value={{ wishlist: items, toggleWishlist, isWishlisted, clearWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
}
