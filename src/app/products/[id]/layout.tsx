import type { Metadata } from "next";
import { SAMPLE_PRODUCTS } from "@/constants";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export function generateStaticParams() {
  return SAMPLE_PRODUCTS.map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const productId = resolvedParams.id;
  const product = SAMPLE_PRODUCTS.find((p) => p.id === productId);

  if (!product) {
    return {
      title: "Product Details",
      description: "Explore premium bicycles and cycling gear at Universal Cycles.",
      alternates: { canonical: `/products/${productId}` },
    };
  }

  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://universalcycles.in";
  const siteUrl = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(rawSiteUrl) ? "https://universalcycles.in" : rawSiteUrl;
  const effectivePrice = product.salePrice ?? product.price;
  const priceFormatted = `₹${effectivePrice.toLocaleString("en-IN")}`;
  const title = `${product.name} (${priceFormatted})`;
  const description = `${product.name} by ${product.brand} - Available now for ${priceFormatted}. ${product.description.slice(0, 140)}...`;

  const imageUrl = product.thumbnail.startsWith("http")
    ? product.thumbnail
    : `${siteUrl}${product.thumbnail.startsWith("/") ? "" : "/"}${product.thumbnail}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/products/${productId}`,
    },
    openGraph: {
      title: `${product.name} — ${priceFormatted}`,
      description,
      url: `${siteUrl}/products/${productId}`,
      siteName: "Universal Cycles",
      locale: "en_IN",
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: product.name,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} — ${priceFormatted}`,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProductDetailLayout({
  params,
  children,
}: Props) {
  const resolvedParams = await params;
  const productId = resolvedParams.id;
  const product = SAMPLE_PRODUCTS.find((p) => p.id === productId);
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://universalcycles.in";
  const siteUrl = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(rawSiteUrl) ? "https://universalcycles.in" : rawSiteUrl;

  const jsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: product.thumbnail.startsWith("http")
          ? product.thumbnail
          : `${siteUrl}${product.thumbnail.startsWith("/") ? "" : "/"}${product.thumbnail}`,
        sku: product.id,
        brand: {
          "@type": "Brand",
          name: product.brand,
        },
        offers: {
          "@type": "Offer",
          url: `${siteUrl}/products/${product.id}`,
          priceCurrency: "INR",
          price: product.salePrice ?? product.price,
          availability:
            product.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
        ...(product.rating
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.rating,
                reviewCount: Math.max(1, product.reviewsCount || 1),
              },
            }
          : {}),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
