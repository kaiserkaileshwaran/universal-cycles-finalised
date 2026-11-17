"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected runtime error
    console.error("Application error captured by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-card border border-border p-8 rounded-3xl shadow-lg">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle size={32} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Something Went Wrong
          </h1>
          <p className="text-muted-foreground text-sm">
            We encountered an unexpected bump in the road. Don&apos;t worry, your cart and session data are safe.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-muted-foreground/60">
              Error Reference: {error.digest}
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <RefreshCcw size={15} /> Try Again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-border bg-background hover:bg-muted text-sm font-semibold transition-colors"
          >
            <Home size={15} /> Back to Store
          </Link>
        </div>
      </div>
    </div>
  );
}
