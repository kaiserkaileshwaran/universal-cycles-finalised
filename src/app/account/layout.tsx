import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your Universal Cycles profile, saved delivery addresses, wishlist, and order history.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
