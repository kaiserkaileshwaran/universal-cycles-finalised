import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Shopping Cart",
  description: "Review your selected bicycles and accessories, apply coupon codes, and proceed to checkout.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
