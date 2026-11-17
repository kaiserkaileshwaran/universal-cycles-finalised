import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/providers";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://universalcycles.in";
const canonicalSiteUrl = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(rawSiteUrl)
  ? "https://universalcycles.in"
  : rawSiteUrl;

export const metadata: Metadata = {
  metadataBase: new URL(canonicalSiteUrl),
  title: {
    default: "Universal Cycles | Premium Bicycles & Accessories",
    template: "%s | Universal Cycles",
  },
  description:
    "Shop premium adult cycles, mountain bikes, road bikes, BMX, electric cycles, and cycling accessories at Universal Cycles. Free shipping above ₹10,000.",
  keywords: "cycles, bicycles, premium bicycles, mountain bikes, electric cycles, road bikes, BMX, cycling accessories",
  authors: [{ name: "Universal Cycles" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: canonicalSiteUrl,
    siteName: "Universal Cycles",
    title: "Universal Cycles | Premium Bicycles & Accessories",
    description: "Shop premium adult cycles, mountain bikes, road bikes, BMX, electric cycles, and cycling accessories.",
    images: [{ url: "/background-landscape.png", width: 1200, height: 630, alt: "Universal Cycles" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Universal Cycles | Premium Bicycles & Accessories",
    description: "Shop premium adult cycles, mountain bikes, road bikes, BMX, electric cycles, and cycling accessories.",
    images: ["/background-landscape.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: ["/icon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1A3620" />
      </head>
      <body className={cn("min-h-screen font-sans antialiased")}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
