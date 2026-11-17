"use client";

import { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from "react";
import { Product } from "@/types";
import { generateId } from "@/lib/utils";
import { usePromotions, isPromotionEligible } from "@/contexts/promotions-context";
import { useStoreSettings } from "@/contexts/store-settings-context";
import { useProducts } from "@/contexts/products-context";
import type { StoreSettings } from "@/constants/store-settings";

export interface CartItem {
  id: string;
  product: Product;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  price: number;
}

interface CartState {
  items: CartItem[];
  couponCode?: string;
  couponDiscount: number;
}

type CartAction =
  | { type: "ADD_ITEM"; payload: { product: Product; variantId?: string; variantLabel?: string; quantity: number } }
  | { type: "REMOVE_ITEM"; payload: { id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "APPLY_COUPON"; payload: { code: string; discount: number } }
  | { type: "REMOVE_COUPON" }
  | { type: "LOAD_CART"; payload: CartState };

const initialState: CartState = {
  items: [],
  couponCode: undefined,
  couponDiscount: 0,
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const { product, variantId, variantLabel, quantity } = action.payload;
      if (product.stock < 1) return state;
      const existingIndex = state.items.findIndex(
        (item) => item.product.id === product.id && item.variantId === variantId
      );

      if (existingIndex >= 0) {
        const updated = [...state.items];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(product.stock, updated[existingIndex].quantity + quantity),
        };
        return { ...state, items: updated };
      }

      const price = product.salePrice ?? product.price;
      return {
        ...state,
        items: [
          ...state.items,
          { id: generateId(), product, variantId, variantLabel, quantity: Math.min(product.stock, quantity), price },
        ],
      };
    }

    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((item) => item.id !== action.payload.id) };

    case "UPDATE_QUANTITY": {
      if (action.payload.quantity < 1) {
        return { ...state, items: state.items.filter((item) => item.id !== action.payload.id) };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.min(item.product.stock, action.payload.quantity) }
            : item
        ),
      };
    }

    case "CLEAR_CART":
      return initialState;

    case "APPLY_COUPON":
      return { ...state, couponCode: action.payload.code, couponDiscount: action.payload.discount };

    case "REMOVE_COUPON":
      return { ...state, couponCode: undefined, couponDiscount: 0 };

    case "LOAD_CART":
      return action.payload;

    default:
      return state;
  }
}

interface CartContextType {
  state: CartState;
  addItem: (product: Product, options?: { variantId?: string; variantLabel?: string; quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
  shippingRates: Pick<StoreSettings, "freeShippingMinimum" | "standardShippingFee" | "expressShippingFee" | "overnightShippingFee">;
  ready: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "universal_cycles_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const ready = true;
  const hydratedRef = useRef(false);
  const { settings } = useStoreSettings();
  const { promotions, getDiscount } = usePromotions();
  const { products } = useProducts();
  const shippingRates = settings;

  // Hydrate cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartState;
        if (parsed && Array.isArray(parsed.items) && (parsed.items.length > 0 || parsed.couponCode)) {
          dispatch({ type: "LOAD_CART", payload: parsed });
        }
      }
    } catch (e) {
      console.error("Failed to load cart from storage", e);
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  // Sync cart items with live product prices and stock from Firebase RTDB
  useEffect(() => {
    if (!hydratedRef.current || state.items.length === 0 || products.length === 0) return;
    let changed = false;
    const syncedItems = state.items
      .map((item) => {
        const liveProduct = products.find((p) => p.id === item.product.id);
        if (!liveProduct) return item;
        if (liveProduct.stock <= 0) {
          changed = true;
          return null;
        }
        const livePrice = liveProduct.salePrice ?? liveProduct.price;
        const cappedQty = Math.min(item.quantity, liveProduct.stock);
        if (
          item.price !== livePrice ||
          item.quantity !== cappedQty ||
          item.product.price !== liveProduct.price ||
          item.product.salePrice !== liveProduct.salePrice ||
          item.product.stock !== liveProduct.stock
        ) {
          changed = true;
          return {
            ...item,
            product: liveProduct,
            price: livePrice,
            quantity: cappedQty,
          };
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    if (changed) {
      dispatch({
        type: "LOAD_CART",
        payload: {
          ...state,
          items: syncedItems,
        },
      });
    }
  }, [products, ready, state]);

  // Persist cart to localStorage whenever items or coupon change
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to persist cart to storage", e);
    }
  }, [state]);

  const addItem = (
    product: Product,
    options?: { variantId?: string; variantLabel?: string; quantity?: number }
  ) => {
    dispatch({
      type: "ADD_ITEM",
      payload: {
        product,
        variantId: options?.variantId,
        variantLabel: options?.variantLabel,
        quantity: options?.quantity ?? 1,
      },
    });
  };

  const removeItem = (id: string) => dispatch({ type: "REMOVE_ITEM", payload: { id } });
  const updateQuantity = (id: string, quantity: number) =>
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } });
  const clearCart = () => dispatch({ type: "CLEAR_CART" });
  const applyCoupon = (code: string, discount: number) =>
    dispatch({ type: "APPLY_COUPON", payload: { code, discount } });
  const removeCoupon = () => dispatch({ type: "REMOVE_COUPON" });

  const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const appliedPromo = state.couponCode ? promotions.find(p => p.code.toLowerCase() === state.couponCode?.toLowerCase() && p.isActive) : null;
  const isAppliedEligible = Boolean(appliedPromo && isPromotionEligible(appliedPromo, subtotal));
  const discount = isAppliedEligible ? getDiscount(state.couponCode, subtotal) : 0;
  const shipping = subtotal >= shippingRates.freeShippingMinimum || (isAppliedEligible && appliedPromo?.kind === "shipping") ? 0 : shippingRates.standardShippingFee;
  const total = Math.max(0, subtotal - discount + shipping);
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!hydratedRef.current || !state.couponCode || state.items.length === 0 || promotions.length === 0) return;
    if (appliedPromo && !isPromotionEligible(appliedPromo, subtotal)) {
      dispatch({ type: "REMOVE_COUPON" });
    }
  }, [appliedPromo, promotions.length, state.couponCode, state.items.length, subtotal]);

  return (
    <CartContext.Provider
      value={{
        state,
        ready,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        subtotal,
        discount,
        shipping,
        total,
        itemCount,
        shippingRates,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
