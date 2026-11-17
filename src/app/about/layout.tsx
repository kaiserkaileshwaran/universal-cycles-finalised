import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Universal Cycles, our passion for cycling, and our pan-India service network.",
  alternates: { canonical: "/about" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
