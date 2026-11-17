import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Bicycles & Gear",
  description: "Search across mountain bikes, road bikes, kids cycles, electric cycles, and accessories at Universal Cycles.",
  alternates: { canonical: "/search" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
