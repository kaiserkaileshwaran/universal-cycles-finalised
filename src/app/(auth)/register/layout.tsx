import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Universal Cycles account for faster checkout, order tracking, and exclusive rewards.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: false },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
