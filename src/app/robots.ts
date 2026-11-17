import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://universalcycles.in";
  const baseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(rawUrl) ? "https://universalcycles.in" : rawUrl;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/checkout", "/cart", "/account", "/track-order"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
