import type { Metadata } from "next";
import { CATEGORIES } from "@/constants";

type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

export function generateStaticParams() {
  const slugs = new Set<string>(["all"]);
  for (const cat of CATEGORIES) {
    slugs.add(cat.slug);
    for (const sub of cat.subcategories || []) {
      slugs.add(sub.slug);
    }
  }
  return Array.from(slugs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORIES.find(
    (c) => c.slug === slug || c.subcategories.some((s) => s.slug === slug)
  );
  const sub = category?.subcategories.find((s) => s.slug === slug);
  const name =
    slug === "all"
      ? "All Bicycles & Accessories"
      : sub?.name || category?.name || "Category";
  const description =
    category?.description ||
    `Browse ${name} at Universal Cycles. Premium bicycles, accessories, and gear with pan-India delivery.`;

  return {
    title: name,
    description,
    alternates: {
      canonical: `/category/${slug}`,
    },
  };
}

export default function CategorySlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
