import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read how Universal Cycles collects, protects, and handles your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
