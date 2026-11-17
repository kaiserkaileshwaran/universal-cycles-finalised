"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, SlidersHorizontal, Grid3X3, List, X, ArrowUpDown, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/products/product-card";
import { SORT_OPTIONS } from "@/constants";
import { useBrands } from "@/contexts/brands-context";
import { useCategories } from "@/contexts/categories-context";
import { Product } from "@/types";
import { cn } from "@/lib/utils";
import { useProducts } from "@/contexts/products-context";
import { recordCustomerInterest } from "@/lib/push-helper";

type ViewMode = "grid" | "list";

export default function CategoryPage() {
  const { categories: CATEGORIES, loaded: categoriesLoaded } = useCategories();
  const { brands } = useBrands();
  const params = useParams();
  const slug = params?.slug as string;
  const [isNewArrivals, setIsNewArrivals] = useState(false);
  const { products: catalogProducts } = useProducts();

  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const filterParam = new URLSearchParams(window.location.search).get("filter");
      if (filterParam === "new-arrivals") {
        setIsNewArrivals(true);
        setSortBy("newest");
      }
    }
  }, []);

  useEffect(() => {
    const titleName = isNewArrivals ? "New Arrivals" : (CATEGORIES.find((c) => c.slug === slug)?.name ?? slug?.replace(/-/g, " ") ?? "Cycles");
    document.title = `${titleName} | Universal Cycles`;
    if (slug && slug !== "all") {
      recordCustomerInterest(slug);
    }
  }, [slug, isNewArrivals, CATEGORIES]);

  const category = CATEGORIES.find((c) => c.slug === slug || c.subcategories.find((s) => s.slug === slug));
  if (slug && slug !== "all" && !category) {
    if (!categoriesLoaded) {
      return (
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto px-4 md:px-8 lg:px-12 pt-28 pb-20">
            <div className="space-y-4 animate-pulse">
              <div className="h-10 w-64 rounded bg-muted" />
              <div className="h-5 w-96 max-w-full rounded bg-muted" />
            </div>
          </main>
          <Footer />
        </div>
      );
    }
    return notFound();
  }

  let products = catalogProducts.filter((product) => product.isActive) as Product[];

  // Filter by last 7 days if viewing new arrivals
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (isNewArrivals) {
    products = products.filter((p) => Date.now() - p.createdAt <= SEVEN_DAYS_MS);
  }

  // Filter by category or subcategory
  if (category && slug && slug !== "all") {
    const matchedSub = category.subcategories.find(s => s.slug === slug);
    if (matchedSub) {
      products = products.filter(p => p.subcategoryId === matchedSub.id || p.categoryId === matchedSub.id);
    } else {
      const validIds = new Set([category.id, ...category.subcategories.map(s => s.id)]);
      products = products.filter(p => validIds.has(p.categoryId) || (p.subcategoryId ? validIds.has(p.subcategoryId) : false));
    }
  }

  // Filter by brand
  if (selectedBrands.length > 0) {
    products = products.filter((p) => selectedBrands.includes(p.brand));
  }

  // Filter by price
  products = products.filter((p) => {
    const price = p.salePrice ?? p.price;
    return price >= priceRange[0] && price <= priceRange[1];
  });

  if (onSaleOnly) products = products.filter((p) => !!p.salePrice);
  if (inStockOnly) products = products.filter((p) => p.stock > 0);

  // Sort
  if (sortBy === "price-asc") {
    products = [...products].sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
  } else if (sortBy === "price-desc") {
    products = [...products].sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
  } else if (sortBy === "rating") {
    products = [...products].sort((a, b) => b.rating - a.rating);
  } else if (sortBy === "newest") {
    products = [...products].sort((a, b) => b.createdAt - a.createdAt);
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const FilterSidebarContent = (
    <div className="space-y-6 p-1">
      {/* Categories */}
      <div className="border border-border rounded-2xl p-5 bg-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Categories</h2>
          <Link href="/category" className="text-xs text-primary hover:underline font-medium">All</Link>
        </div>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const isCatActive = slug === cat.slug || cat.subcategories?.some(s => s.slug === slug);
            return (
              <div key={cat.id} className="space-y-1">
                <Link
                  href={`/category/${cat.slug}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    slug === cat.slug
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : isCatActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  {cat.subcategories && cat.subcategories.length > 0 && (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                      slug === cat.slug ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {cat.subcategories.length}
                    </span>
                  )}
                </Link>
                {cat.subcategories && cat.subcategories.length > 0 && isCatActive && (
                  <div className="ml-3 pl-2.5 border-l-2 border-primary/20 space-y-0.5 py-1">
                    {cat.subcategories.map((sub) => {
                      const isSubActive = slug === sub.slug;
                      return (
                        <Link
                          key={sub.id}
                          href={`/category/${sub.slug}`}
                          className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isSubActive
                              ? "font-semibold text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {sub.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Brands */}
      <div className="border border-border rounded-2xl p-5 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Brand</h2>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            A–Z
          </span>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {brands.map((brand) => (
            <label key={brand.id} className="flex items-center gap-2.5 cursor-pointer group py-0.5">
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand.name)}
                onChange={() => toggleBrand(brand.name)}
                className="rounded border-border accent-primary w-4 h-4"
              />
              <span className={`text-sm transition-colors ${selectedBrands.includes(brand.name) ? "font-semibold text-primary" : "text-foreground group-hover:text-primary"}`}>
                {brand.name}
              </span>
            </label>
          ))}
          {brands.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No brands available.</p>
          )}
        </div>
      </div>

      {/* Price Range */}
      <div className="border border-border rounded-2xl p-5 bg-card">
        <h2 className="font-semibold mb-4">Price Range</h2>
        <div className="space-y-3">
          <input
            type="range"
            aria-label="Maximum price"
            min={0}
            max={500000}
            step={1000}
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>₹{priceRange[0].toLocaleString("en-IN")}</span>
            <span>₹{priceRange[1].toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="border border-border rounded-2xl p-5 bg-card">
        <h2 className="font-semibold mb-4">Quick Filters</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onSaleOnly}
              onChange={(e) => setOnSaleOnly(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            <span className="text-sm">On Sale</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            <span className="text-sm">In Stock Only</span>
          </label>
        </div>
      </div>

      {/* Clear Filters */}
      {(selectedBrands.length > 0 || onSaleOnly || inStockOnly) && (
        <button
          onClick={() => {
            setSelectedBrands([]);
            setOnSaleOnly(false);
            setInStockOnly(false);
            setPriceRange([0, 500000]);
          }}
          className="w-full text-sm text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 justify-center py-2"
        >
          <X size={14} /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
      {/* Breadcrumb */}
      <div className="pt-20 lg:pt-24 border-b">
        <div className="container mx-auto px-4 md:px-8 lg:px-12 py-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium capitalize">
              {isNewArrivals ? "New Arrivals (Last 7 Days)" : (category?.name ?? slug.replace(/-/g, " "))}
            </span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold capitalize">
            {isNewArrivals ? "New Arrivals (Last 7 Days)" : (category?.name ?? slug.replace(/-/g, " "))}
          </h1>
          {isNewArrivals ? (
            <p className="text-base md:text-lg text-muted-foreground mt-2 leading-relaxed py-3.5 max-w-5xl">Showing all fresh cycles and gear added within the last 7 days — engineered with lightweight alloy and carbon frames, precision drivetrains, and reliable all-weather braking for Indian roads and trails.</p>
          ) : category?.description ? (
            <p className="text-base md:text-lg text-muted-foreground mt-2 leading-relaxed py-3.5 max-w-5xl">{category.description} — engineered with lightweight alloy and carbon frames, precision drivetrains, and reliable all-weather braking for Indian roads, urban commutes, and mountain trails.</p>
          ) : null}
          <p className="text-sm text-muted-foreground mt-1">{products.length} products found</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 space-y-6">
              {FilterSidebarContent}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setFiltersOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                <SlidersHorizontal size={16} />
                Filters
                {(selectedBrands.length > 0 || onSaleOnly || inStockOnly) && (
                  <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {selectedBrands.length + (onSaleOnly ? 1 : 0) + (inStockOnly ? 1 : 0)}
                  </span>
                )}
              </button>

              <div className="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto sm:gap-3">
                {/* Sort */}
                <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <ArrowUpDown
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-primary"
                  />
                  <select
                    id="product-sort"
                    aria-label="Sort products"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-border bg-card pl-10 pr-10 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                </div>

                {/* View Toggle */}
                <div className="flex h-11 shrink-0 rounded-xl border border-border bg-card p-1 shadow-sm">
                  <button
                    onClick={() => setViewMode("grid")}
                    aria-label="Show products as a grid"
                    aria-pressed={viewMode === "grid"}
                    className={cn(
                      "flex w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Grid3X3 size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    aria-label="Show products as a list"
                    aria-pressed={viewMode === "list"}
                    className={cn(
                      "flex w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Products */}
            <h2 className="sr-only">Products</h2>
            {products.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🔍</p>
                <h3 className="text-xl font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground">Try adjusting your filters.</p>
              </div>
            ) : (
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6"
                    : "flex flex-col gap-6"
                )}
              >
                {products.map((product) => (
                  <div key={product.id}>
                    <ProductCard product={product} layout={viewMode} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </main>

      <Footer />

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFiltersOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-background shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-bold">Filters</h2>
                <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="p-2 hover:bg-muted rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                {FilterSidebarContent}
              </div>
              <div className="p-4 border-t bg-background">
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-md"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
