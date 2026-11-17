import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers to common questions about bicycle sizing, assembly, delivery, warranty, and returns at Universal Cycles.",
  alternates: { canonical: "/faq" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
