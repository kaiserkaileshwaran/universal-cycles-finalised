import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spin & Win Rewards",
  description: "Spin the Universal Cycles reward wheel for instant discount coupons and free shipping offers.",
  alternates: { canonical: "/spin-wheel" },
};

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
