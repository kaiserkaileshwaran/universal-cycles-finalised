import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offers & Coupons",
  description: "Discover current bicycle deals, discount coupons, and seasonal promotions at Universal Cycles.",
  alternates: { canonical: "/offers" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
