import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Universal Cycles for bicycle inquiries, order support, and service assistance.",
  alternates: { canonical: "/contact" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
