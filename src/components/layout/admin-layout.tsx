"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Package, ShoppingBag, Users, Tag,
  Sparkles,
  ChevronLeft, Menu, LogOut, Truck, MessageSquare,
  ListTree, Star, UserCircle, Award, Settings, Image
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useOrders } from "@/contexts/orders-context";
import { getFirebaseAuth } from "@/firebase/firebase";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/products", label: "Products & Inventory", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: ListTree },
      { href: "/admin/brands", label: "Brand Management", icon: Award },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/promotions", label: "Promotions", icon: Tag },
      { href: "/admin/spin-wheel", label: "Spin Wheel", icon: Sparkles },
      { href: "/admin/messages", label: "Messages & subscribers", icon: MessageSquare },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/homepage-images", label: "Homepage Images", icon: Image },
      { href: "/admin/shipping", label: "Shipping Rules", icon: Truck },
      { href: "/admin/profile", label: "Settings & Profile", icon: Settings },
    ],
  },
];

function Sidebar({
  mobile = false,
  collapsed,
  setCollapsed,
  setMobileOpen,
  pathname,
  user,
  newOrdersCount = 0,
  setHoveredTooltip,
  signOut
}: {
  mobile?: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  setMobileOpen: (v: boolean) => void;
  pathname: string | null;
  user: import("firebase/auth").User | null;
  newOrdersCount?: number;
  setHoveredTooltip?: (val: { label: string, top: number, left: number } | null) => void;
  signOut: () => void;
}) {
  return (
    <aside
      aria-label={mobile ? "Mobile admin sidebar" : "Admin sidebar"}
      className={cn(
        "flex flex-col h-full bg-primary text-primary-foreground transition-all duration-300",
        !mobile && (collapsed ? "w-20" : "w-64")
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-14 px-4 border-b border-primary-foreground/20", collapsed && !mobile ? "justify-center" : "justify-between")}>
        {(!collapsed || mobile) && (
          <span className="font-bold tracking-widest uppercase text-sm text-primary-foreground whitespace-nowrap overflow-hidden">
            Universal Admin
          </span>
        )}
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1 rounded-lg hover:bg-primary-foreground/10 transition-colors shrink-0"
          >
            <ChevronLeft
              size={18}
              className={cn("transition-transform duration-300", collapsed && "rotate-180")}
            />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label={mobile ? "Mobile admin navigation" : "Admin navigation"} className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            {(!collapsed || mobile) && (
              <p className="px-4 text-[11px] font-semibold text-primary-foreground/80 uppercase tracking-wider mb-1">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
              const isOrdersItem = item.href === "/admin/orders";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={collapsed && !mobile ? (isOrdersItem && newOrdersCount > 0 ? `${item.label} (${newOrdersCount} new)` : item.label) : undefined}
                  onClick={() => {
                    if (mobile) setMobileOpen(false);
                    if (setHoveredTooltip) setHoveredTooltip(null);
                  }}
                  onMouseEnter={(e) => {
                    if (collapsed && !mobile && setHoveredTooltip) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredTooltip({ label: isOrdersItem && newOrdersCount > 0 ? `${item.label} (${newOrdersCount} new)` : item.label, top: rect.top, left: rect.right });
                    }
                  }}
                  onMouseLeave={() => {
                    if (setHoveredTooltip) setHoveredTooltip(null);
                  }}
                  className={cn(
                    "relative flex items-center gap-3 py-2 text-sm font-medium transition-all",
                    collapsed && !mobile ? "justify-center px-0" : "px-4",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  )}
                >
                  <item.icon size={18} className="shrink-0" />
                  {(!collapsed || mobile) && <span className="flex-1 truncate">{item.label}</span>}
                  {isOrdersItem && newOrdersCount > 0 && (
                    collapsed && !mobile ? (
                      <span
                        data-testid="sidebar-new-orders-badge"
                        className="absolute top-1 right-3 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold leading-none shadow-sm"
                      >
                        {newOrdersCount}
                      </span>
                    ) : (
                      <span
                        data-testid="sidebar-new-orders-badge"
                        className="ml-auto inline-flex min-w-[22px] h-[20px] px-1.5 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-xs font-extrabold leading-none shadow-sm"
                      >
                        {newOrdersCount}
                      </span>
                    )
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className={cn("border-t border-primary-foreground/20", collapsed && !mobile ? "p-3 flex justify-center" : "p-3")}>
        <div className={cn("flex items-center", collapsed && !mobile ? "justify-center" : "gap-3")}>
          <div className="w-9 h-9 rounded-full bg-primary-foreground/10 flex items-center justify-center shrink-0">
            <UserCircle size={20} />
          </div>
          {(!collapsed || mobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-primary-foreground">{user?.displayName || "Admin User"}</p>
              <p className="text-xs text-primary-foreground/80 truncate">{user?.email || "admin@universal.com"}</p>
            </div>
          )}
          {(!collapsed || mobile) && (
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="p-2 rounded-lg hover:bg-destructive text-primary-foreground/85 hover:text-primary-foreground transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

let globalCollapsed = false;

export function AdminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(globalCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const { orders } = useOrders();
  const router = useRouter();
  const isAdmin = user?.email?.toLowerCase() === "admin@gmail.com";
  const newOrdersCount = orders.filter((o) => o.status === "pending").length;

  const setCollapsed = (val: boolean) => {
    globalCollapsed = val;
    setCollapsedState(val);
  };

  const [hoveredTooltip, setHoveredTooltip] = useState<{ label: string, top: number, left: number } | null>(null);

  useEffect(() => {
    if (loading || isAdmin) return;
    if (user) {
      router.replace("/account");
      return;
    }
    // A successful Firebase sign-in can resolve just before its auth-state
    // listener publishes the new user. Give that listener a brief chance first.
    const redirectTimer = window.setTimeout(() => {
      try {
        if (!getFirebaseAuth().currentUser) router.replace("/login");
      } catch {
        router.replace("/login");
      }
    }, 900);
    return () => window.clearTimeout(redirectTimer);
  }, [isAdmin, user, loading, router]);

  if (loading || !isAdmin || !user) {
    return (
      <main className="h-screen flex items-center justify-center bg-muted/30">
        <h1 className="text-sm font-medium text-muted-foreground">Loading admin...</h1>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* Tooltip Portal-like */}
      <AnimatePresence>
        {hoveredTooltip && collapsed && !mobileOpen && (
          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.15 }}
            style={{ top: hoveredTooltip.top + 8, left: hoveredTooltip.left + 8 }}
            className="fixed z-[100] bg-foreground text-background font-bold text-sm px-3 py-1.5 rounded-lg shadow-xl border border-border pointer-events-none whitespace-nowrap"
          >
            {hoveredTooltip.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
          pathname={pathname}
          user={user}
          newOrdersCount={newOrdersCount}
          setHoveredTooltip={setHoveredTooltip}
          signOut={async () => {
            await signOut();
            router.push("/");
          }}
        />
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className="fixed left-0 top-0 bottom-0 w-64 z-50 lg:hidden"
            >
              <Sidebar
                mobile
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                setMobileOpen={setMobileOpen}
                pathname={pathname}
                user={user}
                newOrdersCount={newOrdersCount}
                signOut={async () => {
                  await signOut();
                  router.push("/");
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
          <button aria-label="Open admin menu" className="lg:hidden p-2 hover:bg-muted rounded-lg" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="hidden sm:block">
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Link href="/" className="text-xs text-primary hover:underline hidden sm:block">
              ← View Store
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
