"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onValue, ref, set } from "firebase/database";
import { getFirebaseDatabase, isFirebaseConfigured } from "@/firebase/firebase";
import { useAuth } from "@/contexts/auth-context";
import { sanitizeForFirebase } from "@/lib/use-firebase-state";
import type { Address } from "@/types";

type AddressBook = Record<string, Address[]>;
interface AddressValue {
  getAddresses: (userId: string) => Address[];
  saveAddress: (userId: string, address: Address) => void;
  setDefaultAddress: (userId: string, addressId: string) => void;
  deleteAddress: (userId: string, addressId: string) => void;
  ready: boolean;
}
const AddressContext = createContext<AddressValue | undefined>(undefined);

const LOCAL_ADDR_PREFIX = "uc_addresses_";

function readLocalAddresses(userId: string): Address[] {
  if (typeof window === "undefined" || !userId || userId === "guest") return [];
  try {
    const raw = window.localStorage.getItem(`${LOCAL_ADDR_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Address[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAddresses(userId: string, list: Address[]): void {
  if (typeof window === "undefined" || !userId || userId === "guest") return;
  try {
    window.localStorage.setItem(`${LOCAL_ADDR_PREFIX}${userId}`, JSON.stringify(list));
  } catch {}
}

export function AddressesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [book, setBook] = useState<AddressBook>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setReady(true);
      return;
    }

    const cached = readLocalAddresses(user.uid);
    if (cached.length > 0) {
      setBook((prev) => ({ ...prev, [user.uid]: cached }));
    }

    if (!isFirebaseConfigured()) {
      setReady(true);
      return;
    }

    try {
      const db = getFirebaseDatabase();
      const userAddrRef = ref(db, `addresses/${user.uid}`);
      const unsubscribe = onValue(
        userAddrRef,
        (snapshot) => {
          const val = snapshot.val();
          const rtdbList: Address[] = Array.isArray(val)
            ? (val as Address[])
            : val && typeof val === "object"
              ? (Object.values(val) as Address[])
              : [];
          const finalList = rtdbList.length > 0 ? rtdbList : readLocalAddresses(user.uid);
          if (rtdbList.length > 0) {
            writeLocalAddresses(user.uid, rtdbList);
          }
          setBook((prev) => ({ ...prev, [user.uid]: finalList }));
          setReady(true);
        },
        () => {
          setReady(true);
        }
      );
      return () => unsubscribe();
    } catch {
      setReady(true);
      return;
    }
  }, [user, authLoading]);

  const persistUserAddresses = useCallback((userId: string, list: Address[]) => {
    if (!userId || userId === "guest") return;
    writeLocalAddresses(userId, list);
    if (!isFirebaseConfigured()) return;
    try {
      const db = getFirebaseDatabase();
      set(ref(db, `addresses/${userId}`), sanitizeForFirebase(list)).catch(() => {});
    } catch {}
  }, []);

  const getAddresses = useCallback((userId: string) => book[userId] ?? [], [book]);

  const saveAddress = useCallback((userId: string, address: Address) => {
    setBook((current) => {
      const existing = current[userId] ?? [];
      const index = existing.findIndex((item) => item.id === address.id);

      let nextList: Address[];
      if (index >= 0) {
        nextList = [...existing];
        nextList[index] = address;
      } else {
        const same = (item: Address) =>
          item.street1.toLowerCase() === address.street1.toLowerCase() &&
          item.zipCode === address.zipCode;
        if (existing.some(same)) return current;
        const withDefault = existing.length === 0 ? { ...address, isDefault: true } : address;
        nextList = [withDefault, ...existing];
      }
      persistUserAddresses(userId, nextList);
      return { ...current, [userId]: nextList };
    });
  }, [persistUserAddresses]);

  const setDefaultAddress = useCallback((userId: string, addressId: string) => {
    setBook((current) => {
      const nextList = (current[userId] ?? []).map((address) => ({
        ...address,
        isDefault: address.id === addressId,
      }));
      persistUserAddresses(userId, nextList);
      return { ...current, [userId]: nextList };
    });
  }, [persistUserAddresses]);

  const deleteAddress = useCallback((userId: string, addressId: string) => {
    setBook((current) => {
      const addresses = current[userId] ?? [];
      const removedDefault = addresses.find((address) => address.id === addressId)?.isDefault;
      const remaining = addresses.filter((address) => address.id !== addressId);
      if (removedDefault && remaining[0]) remaining[0] = { ...remaining[0], isDefault: true };
      persistUserAddresses(userId, remaining);
      return { ...current, [userId]: remaining };
    });
  }, [persistUserAddresses]);

  return (
    <AddressContext.Provider value={{ getAddresses, saveAddress, setDefaultAddress, deleteAddress, ready }}>
      {children}
    </AddressContext.Provider>
  );
}

export function useAddresses() {
  const context = useContext(AddressContext);
  if (!context) throw new Error("useAddresses must be used within AddressesProvider");
  return context;
}
