import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Shop by Category",
    template: "%s | Universal Cycles",
  },
  description: "Browse adult bicycles, kids cycles, mountain bikes, electric cycles, and cycling accessories.",
  alternates: { canonical: "/category" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
