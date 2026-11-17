"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Tag, Clock, Copy, Check, ShoppingBag, Sparkles } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/products/product-card";
import { useProducts } from "@/contexts/products-context";
import { usePromotions } from "@/contexts/promotions-context";
import { useCart } from "@/contexts/cart-context";

const BANNERS = [
  {
    title: "End of Season Sale",
    subtitle: "Compare live sale prices on selected cycles",
    cta: "Shop Cycles",
    href: "/category/adult-cycles",
    bg: "from-primary to-primary/80",
  },
  {
    title: "Kids Fiesta",
    subtitle: "Browse bikes for growing riders",
    cta: "Shop Kids Bikes",
    href: "/category/kids-bicycles",
    bg: "from-amber-800 to-orange-900",
  },
  {
    title: "Accessory Sale",
    subtitle: "Explore helmets, locks, lights, and riding essentials",
    cta: "Shop accessories",
    href: "/category/accessories",
    bg: "from-purple-700 to-indigo-800",
  },
];

export default function OffersPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);
  const { products } = useProducts();
  const { promotions } = usePromotions();
  const { state: cartState, applyCoupon } = useCart();

  useEffect(() => {
    document.title = "Deals & Offers | Universal Cycles";
  }, []);

  const saleProducts = products.filter((p) => p.isActive && p.salePrice);
  const activeCoupons = promotions.filter((p) => p.isActive && p.isPublic !== false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleApplyCoupon = (code: string, value: number) => {
    applyCoupon(code, value);
    setAppliedFeedback(code);
    setTimeout(() => setAppliedFeedback(null), 2500);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 lg:pt-24">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary to-primary/85 text-primary-foreground py-16 text-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Tag size={40} className="text-accent mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-3">Deals & Offers</h1>
            <p className="text-primary-foreground/85 text-lg max-w-xl mx-auto">
              Current sale prices and checkout coupon codes — updated live from the store.
            </p>
          </motion.div>
        </div>

        <div className="container mx-auto px-4 md:px-8 lg:px-12 py-12 space-y-16">
          {/* Deal Banners */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BANNERS.map((banner, i) => (
              <motion.div
                key={banner.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={banner.href}>
                  <div className={`relative bg-gradient-to-br ${banner.bg} text-white rounded-2xl p-8 h-48 flex flex-col justify-end overflow-hidden group`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-8 -translate-y-8" />
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-6 translate-y-6" />
                    <div className="relative z-10">
                      <h2 className="text-xl font-bold">{banner.title}</h2>
                      <p className="text-sm text-white/90 mt-1 mb-3">{banner.subtitle}</p>
                      <span className="inline-flex items-center gap-1 bg-white text-slate-900 px-4 py-1.5 rounded-full text-sm font-bold group-hover:scale-105 transition-transform">
                        {banner.cta} →
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Coupon Codes (Live from Firebase Promotions Context) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">Active Store Coupons</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Click to copy or apply directly to your current cart
                </p>
              </div>
              <Link
                href="/spin-wheel"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:bg-accent/90 transition-colors shadow-sm"
              >
                <Sparkles size={16} /> Spin to Win Extra Discounts
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeCoupons.map((coupon, i) => {
                const isCurrentlyApplied = cartState.couponCode?.toUpperCase() === coupon.code.toUpperCase();
                const wasJustApplied = appliedFeedback === coupon.code;

                return (
                  <motion.div
                    key={coupon.id || coupon.code}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="border-2 border-dashed border-primary/40 rounded-2xl p-5 bg-card flex flex-col justify-between gap-4 shadow-sm hover:border-primary transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-lg text-primary tracking-wide">
                          {coupon.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCode(coupon.code)}
                          title="Copy coupon code"
                          className="p-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg text-primary transition-colors shrink-0"
                        >
                          {copiedCode === coupon.code ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                      <p className="text-sm font-medium text-foreground">{coupon.description}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock size={13} />
                        <span>Min. spend: {coupon.minimum > 0 ? `₹${coupon.minimum.toLocaleString("en-IN")}` : "No minimum"}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      {isCurrentlyApplied ? (
                        <div className="w-full py-2 px-3 rounded-xl bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                          <Check size={14} /> Applied to Cart
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon(coupon.code, coupon.value)}
                          className="w-full py-2 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <ShoppingBag size={14} /> {wasJustApplied ? "Applied!" : "Apply to Cart"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {activeCoupons.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <p className="text-muted-foreground text-sm">No special coupon codes active right now. Check back soon!</p>
              </div>
            )}
          </div>

          {/* Sale Products */}
          {saleProducts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">Current Sale Prices</h2>
                  <p className="text-muted-foreground text-sm mt-1">Discounted cycles ready for delivery</p>
                </div>
                <Link href="/category/all" className="text-sm font-semibold text-primary hover:underline">
                  View all cycles →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {saleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
