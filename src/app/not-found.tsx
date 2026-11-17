"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SafeImage } from "@/components/ui/safe-image";
import { Search, Home, Compass, ArrowRight } from "lucide-react";

export default function NotFound() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const quickLinks = [
    { label: "Mountain Bikes", href: "/category/mountain-bikes" },
    { label: "Road Bikes", href: "/category/road-bikes" },
    { label: "Electric Cycles", href: "/category/electric-cycles" },
    { label: "Accessories", href: "/category/accessories" },
    { label: "Special Offers", href: "/offers" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full text-center space-y-8">
          {/* Bicycle Illustration */}
          <div className="relative mx-auto w-48 h-36 sm:w-60 sm:h-44">
            <SafeImage
              src="/placeholder-cycle.svg"
              alt="Universal Cycles 404"
              fill
              className="object-contain opacity-90"
              fallbackSrc="/placeholder-cycle.svg"
            />
          </div>

          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary">
              <Compass size={14} /> Error 404 • Lost on the Trail
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
              Off the Beaten Path
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
              The page or bicycle route you are looking for has been moved, renamed, or doesn&apos;t exist. Let&apos;s get you back in gear.
            </p>
          </div>

          {/* Interactive Search Bar */}
          <form onSubmit={handleSearch} className="relative max-w-md mx-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cycles, gear, or parts..."
              className="w-full h-12 pl-11 pr-24 rounded-full border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Quick Categories */}
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Explore Popular Categories
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3.5 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:text-accent-foreground text-xs font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              <Home size={16} /> Return to Home
            </Link>
            <Link
              href="/category/all"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-card hover:bg-muted text-sm font-semibold transition-colors"
            >
              Browse All <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
