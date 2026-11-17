import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy",
  description: "Learn about Universal Cycles pan-India bicycle shipping rates, weight-based delivery, and timelines.",
  alternates: { canonical: "/shipping" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
