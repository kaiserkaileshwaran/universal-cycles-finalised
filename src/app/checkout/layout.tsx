import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure Checkout",
  description: "Complete your Universal Cycles bicycle order with pan-India delivery and UPI/Razorpay or COD payment.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
