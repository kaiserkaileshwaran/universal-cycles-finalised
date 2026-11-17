"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home as HomeIcon, Search, ShoppingBag, User, Menu, X, Heart, Moon, Sun, ChevronDown, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useWishlist } from "@/contexts/wishlist-context";
import { useTheme } from "@/contexts/theme-context";
import { useCategories } from "@/contexts/categories-context";
import { SearchOverlay } from "@/components/search/search-overlay";
import { useStoreSettings } from "@/contexts/store-settings-context";

export function Navbar() {
  const { categories: CATEGORIES } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState<string | null>(null);

  const { user } = useAuth();
  const { itemCount } = useCart();
  const { wishlist } = useWishlist();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useStoreSettings();
  const pathname = usePathname();
  const isHomeActive = pathname === "/";
  const isSearchActive = pathname === "/search" || searchOpen;
  const isWishlistActive = pathname === "/account/wishlist";
  const isCartActive = pathname === "/cart";
  const isProfileActive = ["/account", "/login", "/register", "/reset-password", "/admin"].includes(pathname);
  const mobileNavItemClass = (active: boolean) =>
    `flex h-full flex-col items-center justify-center gap-1 text-[10px] leading-none ${active ? "font-semibold text-primary" : "font-medium text-foreground"}`;

  const navContainerRef = useRef<HTMLDivElement>(null);
  const measuringRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(CATEGORIES.length);

  const updateOverflow = useCallback(() => {
    if (!navContainerRef.current || !measuringRef.current) return;
    const containerWidth = navContainerRef.current.clientWidth;
    if (containerWidth <= 0) return;

    const measureChildren = Array.from(measuringRef.current.children) as HTMLElement[];
    const categoryElements = measureChildren.slice(0, CATEGORIES.length);
    const moreBtnElement = measureChildren[CATEGORIES.length];
    const offersBtnElement = measureChildren[CATEGORIES.length + 1];

    const catWidths = categoryElements.map((el) => el.offsetWidth + 4);
    const moreWidth = (moreBtnElement?.offsetWidth || 75) + 4;
    const offersWidth = (offersBtnElement?.offsetWidth || 90) + 4;

    const totalAllWidth = catWidths.reduce((sum, w) => sum + w, 0) + offersWidth;

    if (totalAllWidth <= containerWidth) {
      setVisibleCount(CATEGORIES.length);
      return;
    }

    let availableWidth = containerWidth - moreWidth - offersWidth;
    let count = 0;
    for (let i = 0; i < catWidths.length; i++) {
      if (availableWidth - catWidths[i] >= 0) {
        availableWidth -= catWidths[i];
        count++;
      } else {
        break;
      }
    }

    setVisibleCount(Math.max(1, count));
  }, [CATEGORIES]);

  useEffect(() => {
    updateOverflow();

    if (typeof window === "undefined") return;

    const ro = new ResizeObserver(() => {
      updateOverflow();
    });

    if (navContainerRef.current) {
      ro.observe(navContainerRef.current);
    }

    window.addEventListener("resize", updateOverflow);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [updateOverflow]);

  const primaryCategories = CATEGORIES.slice(0, visibleCount);
  const moreCategories = CATEGORIES.slice(visibleCount);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("header")) {
        setMegaMenuOpen(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMegaMenuOpen(null);
    };
    document.addEventListener("click", handleGlobalClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <header className="fixed top-0 w-full z-40 transition-all duration-300 bg-background md:bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="relative w-full max-w-[1536px] mx-auto px-6 md:px-12 lg:px-16 h-16 lg:h-20 flex items-center justify-between">
          
          {/* Left: Mobile Menu & Desktop Logo */}
          <div className="shrink-0 flex items-center justify-start gap-2 z-10">
            {/* Mobile: Hamburger */}
            <button
              className="xl:hidden p-2 -ml-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} className="text-foreground" />
            </button>

            {/* Desktop Logo */}
            <Link 
              href="/" 
              className="hidden xl:flex items-center gap-3 shrink-0"
            >
              <span
                aria-hidden="true"
                className="rounded-lg h-14 w-14 shrink-0 bg-foreground inline-block"
                style={{ WebkitMask: "url('/logo.svg') center / contain no-repeat", mask: "url('/logo.svg') center / contain no-repeat" }}
              />
              <span title={settings.storeName} className="whitespace-nowrap font-bold text-lg sm:text-xl xl:text-2xl transition-colors text-primary">
                {settings.storeName}
              </span>
            </Link>
          </div>

          {/* Mobile Logo (Centered on mobile/tablet screens) */}
          <Link 
            href="/" 
            aria-label={settings.storeName || "Universal Cycles"}
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 shrink-0 xl:hidden"
          >
            <span
              aria-hidden="true"
              className="rounded-lg h-10 w-10 md:h-12 md:w-12 shrink-0 bg-foreground inline-block"
              style={{ WebkitMask: "url('/logo.svg') center / contain no-repeat", mask: "url('/logo.svg') center / contain no-repeat" }}
            />
            <span title={settings.storeName} className="whitespace-nowrap font-bold text-sm md:text-lg transition-colors text-primary hidden sm:block">
              {settings.storeName}
            </span>
          </Link>

          {/* Center: Desktop Navigation bounded between Brand and Action symbols */}
          <div ref={navContainerRef} className="hidden xl:flex flex-1 min-w-0 mx-3 2xl:mx-6 items-center justify-center relative">
            {/* Hidden measuring probe to compute exact item widths in real-time */}
            <div
              ref={measuringRef}
              aria-hidden="true"
              className="absolute top-0 left-0 opacity-0 pointer-events-none -z-50 invisible flex items-center gap-1 select-none"
            >
              {CATEGORIES.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium whitespace-nowrap">
                  <span>{cat.name}</span>
                  <span className="w-3.5 h-3.5 shrink-0" />
                </div>
              ))}
              <div className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap">
                <span>More</span>
                <span className="w-3.5 h-3.5 shrink-0" />
              </div>
              <div className="px-4 py-2 text-sm font-medium whitespace-nowrap">
                Offers 🔥
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav aria-label="Main navigation" className="flex items-center gap-1">
              {primaryCategories.map((cat) => {
                const isOpen = megaMenuOpen === cat.id;
                const hasSubcategories = cat.subcategories && cat.subcategories.length > 0;

                return (
                  <div
                    key={cat.id}
                    className="relative"
                    onMouseEnter={() => setMegaMenuOpen(cat.id)}
                    onMouseLeave={() => setMegaMenuOpen(null)}
                  >
                    <button
                      onClick={() => setMegaMenuOpen(isOpen ? null : cat.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted ${
                        isOpen ? "text-primary bg-muted/60" : "text-foreground hover:text-primary"
                      }`}
                    >
                      <span>{cat.name}</span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : "text-muted-foreground"}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 pt-2 w-60 z-50"
                        >
                          <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden p-2">
                            <Link
                              href={`/category/${cat.slug}`}
                              onClick={() => setMegaMenuOpen(null)}
                              className="block px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              Shop All {cat.name}
                            </Link>
                            {hasSubcategories && (
                              <>
                                <div className="h-px bg-border/70 mx-2 my-1" />
                                <div className="space-y-0.5">
                                  {cat.subcategories.map((sub) => (
                                    <Link
                                      key={sub.id}
                                      href={`/category/${sub.slug}`}
                                      onClick={() => setMegaMenuOpen(null)}
                                      className="block px-3.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                    >
                                      {sub.name}
                                    </Link>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* More Categories Dropdown if > 5 */}
              {moreCategories.length > 0 && (
                <div
                  className="relative"
                  onMouseEnter={() => setMegaMenuOpen("more-categories")}
                  onMouseLeave={() => setMegaMenuOpen(null)}
                >
                  <button
                    onClick={() => setMegaMenuOpen(megaMenuOpen === "more-categories" ? null : "more-categories")}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted ${
                      megaMenuOpen === "more-categories" ? "text-primary bg-muted/60" : "text-foreground hover:text-primary"
                    }`}
                  >
                    <span>More</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${
                        megaMenuOpen === "more-categories" ? "rotate-180 text-primary" : "text-muted-foreground"
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {megaMenuOpen === "more-categories" && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 pt-2 w-64 z-50"
                      >
                        <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden p-2 max-h-96 overflow-y-auto">
                          {moreCategories.map((cat) => (
                            <div key={cat.id} className="mb-2 last:mb-0">
                              <Link
                                href={`/category/${cat.slug}`}
                                onClick={() => setMegaMenuOpen(null)}
                                className="block px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              >
                                {cat.name}
                              </Link>
                              {cat.subcategories && cat.subcategories.length > 0 && (
                                <div className="ml-2 pl-2 border-l border-border/80 space-y-0.5 mt-0.5">
                                  {cat.subcategories.map((sub) => (
                                    <Link
                                      key={sub.id}
                                      href={`/category/${sub.slug}`}
                                      onClick={() => setMegaMenuOpen(null)}
                                      className="block px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                    >
                                      {sub.name}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <Link
                href="/offers"
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-accent-foreground bg-accent hover:bg-accent/90 whitespace-nowrap shrink-0"
              >
                Offers 🔥
              </Link>
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="shrink-0 flex items-center justify-end gap-1 md:gap-2 z-10">
            {/* Search (Desktop) */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg transition-colors text-foreground hover:text-primary hover:bg-muted hidden md:flex"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* Wishlist (Desktop) */}
            <Link
              href="/account/wishlist"
              className="relative p-2 rounded-lg transition-colors text-foreground hover:text-primary hover:bg-muted hidden sm:flex"
              aria-label={wishlist.length > 0 ? `Wishlist ${wishlist.length}` : "Wishlist"}
            >
              <Heart size={20} />
              {wishlist.length > 0 && (
                <span aria-hidden="true" className="absolute top-0 right-0 bg-destructive text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {wishlist.length}
                </span>
              )}
            </Link>

            {/* Cart (Desktop - symbol only) */}
            <Link
              href="/cart"
              className="relative p-2 rounded-lg transition-colors text-foreground hover:text-primary hover:bg-muted hidden md:flex"
              aria-label={itemCount > 0 ? `Shopping cart ${itemCount}` : "Shopping cart"}
              aria-current={isCartActive ? "page" : undefined}
            >
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span aria-hidden="true" className="absolute top-0 right-0 bg-accent text-accent-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Order Track (Mobile & Desktop) */}
            <Link
              href="/track-order"
              className="p-2 rounded-lg transition-colors text-foreground hover:text-primary hover:bg-muted flex"
              aria-label="Track Order"
              title="Track Order"
            >
              <Package size={20} />
            </Link>

            {/* Account (Desktop) */}
            <Link
              href={user ? (user.email?.toLowerCase() === "admin@gmail.com" ? "/admin" : "/account") : "/login"}
              className="p-2 rounded-lg transition-colors text-foreground hover:text-primary hover:bg-muted hidden sm:flex"
              aria-label="Account"
            >
              <User size={20} />
            </Link>

            {/* Theme Toggle (Desktop) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors text-foreground hover:text-primary hover:bg-muted hidden md:flex"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] sm:w-80 bg-background z-50 overflow-y-auto"
            >
              <div className="p-4 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="rounded-lg h-8 w-8 shrink-0 bg-foreground inline-block"
                    style={{ WebkitMask: "url('/logo.svg') center / contain no-repeat", mask: "url('/logo.svg') center / contain no-repeat" }}
                  />
                  <span className="font-bold tracking-widest uppercase text-primary text-sm">Universal</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="p-2 hover:bg-muted rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-1">
                {CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <Link
                      href={`/category/${cat.slug}`}
                      className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-muted font-medium text-foreground"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {cat.name}
                    </Link>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="ml-4 space-y-1 mb-2">
                        {cat.subcategories.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/category/${sub.slug}`}
                            className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="h-px bg-border my-3" />

                <Link
                  href="/offers"
                  className="flex items-center px-3 py-3 rounded-xl hover:bg-muted font-semibold text-foreground bg-accent/20"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  🔥 Deals & Offers
                </Link>

                <div className="h-px bg-border my-3" />

                <Link
                  href={user ? (user.email?.toLowerCase() === "admin@gmail.com" ? "/admin" : "/account") : "/login"}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User size={18} className="text-muted-foreground" />
                  <span>{user ? (user.email?.toLowerCase() === "admin@gmail.com" ? "Admin Dashboard" : "My Account") : "Log In / Sign Up"}</span>
                </Link>

                <Link
                  href="/account/wishlist"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Heart size={18} className="text-muted-foreground" />
                  <span>Wishlist ({wishlist.length})</span>
                </Link>

                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-muted"
                >
                  {theme === "dark" ? <Sun size={18} className="text-muted-foreground" /> : <Moon size={18} className="text-muted-foreground" />}
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        aria-label="Mobile navigation"
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid h-[calc(4.25rem+env(safe-area-inset-bottom))] grid-cols-5 items-center border-t border-border bg-background px-1 pt-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden"
      >
        <Link href="/" aria-current={isHomeActive ? "page" : undefined} className={mobileNavItemClass(isHomeActive)}>
          <HomeIcon size={20} />
          <span>Home</span>
        </Link>
        <button type="button" onClick={() => setSearchOpen(true)} className={mobileNavItemClass(isSearchActive)} aria-label="Search" aria-pressed={isSearchActive}>
          <Search size={20} />
          <span>Search</span>
        </button>
        <Link href="/account/wishlist" aria-current={isWishlistActive ? "page" : undefined} className={mobileNavItemClass(isWishlistActive)}>
          <span className="relative">
            <Heart size={20} />
            {wishlist.length > 0 && <span aria-hidden="true" className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">{wishlist.length}</span>}
          </span>
          <span>Wishlist</span>
        </Link>
        <Link href="/cart" aria-current={isCartActive ? "page" : undefined} className={mobileNavItemClass(isCartActive)}>
          <span className="relative">
            <ShoppingBag size={20} />
            {itemCount > 0 && <span aria-hidden="true" className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">{itemCount}</span>}
          </span>
          <span>Cart</span>
        </Link>
        <Link href={user ? (user.email?.toLowerCase() === "admin@gmail.com" ? "/admin" : "/account") : "/login"} aria-current={isProfileActive ? "page" : undefined} className={mobileNavItemClass(isProfileActive)}>
          <User size={20} />
          <span>Profile</span>
        </Link>
      </nav>

      <SearchOverlay key={searchOpen ? "open" : "closed"} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
