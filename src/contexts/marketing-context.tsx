"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ref, onValue, set, update, remove } from "firebase/database";
import { getFirebaseDatabase, isFirebaseConfigured } from "@/firebase/firebase";
import { useAuth } from "@/contexts/auth-context";

export interface ContactMessage {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  createdAt: number;
  read: boolean;
}
export interface Subscriber {
  id: string;
  email: string;
  subscribedAt: number;
}

interface MarketingValue {
  messages: ContactMessage[];
  subscribers: Subscriber[];
  sendMessage: (message: Omit<ContactMessage, "id" | "createdAt" | "read">) => void;
  subscribe: (email: string) => "added" | "exists";
  markMessageRead: (id: string) => void;
  deleteMessage: (id: string) => void;
  unsubscribe: (id: string) => void;
  ready: boolean;
}

const MarketingContext = createContext<MarketingValue | undefined>(undefined);

export function MarketingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === "admin@gmail.com";

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [ready, setReady] = useState(true);

  // Per database security rules: only admin@gmail.com can read contact_messages and subscribers
  useEffect(() => {
    if (!isFirebaseConfigured() || !isAdmin) {
      return;
    }

    try {
      const db = getFirebaseDatabase();
      const msgsRef = ref(db, "contact_messages");
      const subsRef = ref(db, "subscribers");

      const unsubMsgs = onValue(
        msgsRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const list = Array.isArray(data) ? data : Object.values(data);
            setMessages(list as ContactMessage[]);
          } else {
            setMessages([]);
          }
        },
        (err) => {
          console.warn("[Firebase RTDB] Contact messages read notice:", err.message);
        }
      );

      const unsubSubs = onValue(
        subsRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const list = Array.isArray(data) ? data : Object.values(data);
            setSubscribers(list as Subscriber[]);
          } else {
            setSubscribers([]);
          }
          setReady(true);
        },
        (err) => {
          console.warn("[Firebase RTDB] Subscribers read notice:", err.message);
          setReady(true);
        }
      );

      return () => {
        unsubMsgs();
        unsubSubs();
      };
    } catch (err) {
      console.warn("[Firebase RTDB] Marketing listener error:", err);
      setReady(true);
    }
  }, [isAdmin]);

  const sendMessage = useCallback((message: Omit<ContactMessage, "id" | "createdAt" | "read">) => {
    const newMessage: ContactMessage = {
      ...message,
      id: `m${Date.now()}`,
      createdAt: Date.now(),
      read: false,
    };
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseDatabase();
        set(ref(db, `contact_messages/${newMessage.id}`), newMessage).catch((err) => {
          console.warn("[Firebase RTDB] Could not save contact message:", err);
        });
      } catch (err) {
        console.warn("[Firebase RTDB] Contact message send notice:", err);
      }
    }
    setMessages((current) => [newMessage, ...(current || [])]);
  }, []);

  const subscribe = useCallback((email: string) => {
    const normalized = email.trim().toLowerCase();
    const deterministicId = `sub_${normalized.replace(/[^a-z0-9]/g, "_")}`;
    const newSub: Subscriber = { id: deterministicId, email: normalized, subscribedAt: Date.now() };
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseDatabase();
        set(ref(db, `subscribers/${newSub.id}`), newSub).catch((err) => {
          console.warn("[Firebase RTDB] Could not save subscriber:", err);
        });
      } catch (err) {
        console.warn("[Firebase RTDB] Subscribe notice:", err);
      }
    }
    setSubscribers((current) => {
      const existing = (current || []).filter((s) => s.email.toLowerCase() !== normalized && s.id !== deterministicId);
      return [newSub, ...existing];
    });
    return "added" as const;
  }, []);

  const markMessageRead = useCallback((id: string) => {
    setMessages((current) => (current || []).map((message) => message.id === id ? { ...message, read: true } : message));
    if (isFirebaseConfigured() && isAdmin) {
      try {
        const db = getFirebaseDatabase();
        update(ref(db, `contact_messages/${id}`), { read: true }).catch(console.warn);
      } catch (err) {
        console.warn("[Firebase RTDB] Mark read notice:", err);
      }
    }
  }, [isAdmin]);

  const deleteMessage = useCallback((id: string) => {
    setMessages((current) => (current || []).filter((message) => message.id !== id));
    if (isFirebaseConfigured() && isAdmin) {
      try {
        const db = getFirebaseDatabase();
        remove(ref(db, `contact_messages/${id}`)).catch(console.warn);
      } catch (err) {
        console.warn("[Firebase RTDB] Delete message notice:", err);
      }
    }
  }, [isAdmin]);

  const unsubscribe = useCallback((id: string) => {
    setSubscribers((current) => (current || []).filter((subscriber) => subscriber.id !== id));
    if (isFirebaseConfigured() && isAdmin) {
      try {
        const db = getFirebaseDatabase();
        remove(ref(db, `subscribers/${id}`)).catch(console.warn);
      } catch (err) {
        console.warn("[Firebase RTDB] Unsubscribe notice:", err);
      }
    }
  }, [isAdmin]);

  return (
    <MarketingContext.Provider
      value={{
        messages: messages || [],
        subscribers: subscribers || [],
        sendMessage,
        subscribe,
        markMessageRead,
        deleteMessage,
        unsubscribe,
        ready,
      }}
    >
      {children}
    </MarketingContext.Provider>
  );
}

export function useMarketing() {
  const context = useContext(MarketingContext);
  if (!context) throw new Error("useMarketing must be used within MarketingProvider");
  return context;
}
