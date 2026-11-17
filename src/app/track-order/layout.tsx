import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Track your Universal Cycles order status, delivery progress, and complete online UPI/Razorpay payments.",
  alternates: { canonical: "/track-order" },
  robots: { index: false, follow: false },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
