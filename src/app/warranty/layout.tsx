import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warranty & Support",
  description: "Comprehensive frame and component warranty coverage for bicycles purchased from Universal Cycles.",
  alternates: { canonical: "/warranty" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
