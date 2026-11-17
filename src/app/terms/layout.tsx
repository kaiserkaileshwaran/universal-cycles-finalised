import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions governing purchases and use of the Universal Cycles storefront.",
  alternates: { canonical: "/terms" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
