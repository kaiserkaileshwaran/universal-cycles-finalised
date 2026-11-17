"use client";

import { useState, useEffect } from "react";
import Image, { type ImageProps } from "next/image";

export interface SafeImageProps extends Omit<ImageProps, "src"> {
  src?: string | null;
  fallbackSrc?: string;
}

const DEFAULT_FALLBACK = "/placeholder-cycle.svg";

export function SafeImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className,
  ...props
}: SafeImageProps) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  const effectiveSrc = (!src || typeof src !== "string" || !src.trim() || error)
    ? fallbackSrc
    : src.trim();

  const isExternal = typeof effectiveSrc === "string" && (effectiveSrc.startsWith("http://") || effectiveSrc.startsWith("https://"));
  const isOptimizableExternal =
    isExternal &&
    /^https:\/\/(images\.unsplash\.com|plus\.unsplash\.com|images\.pexels\.com|firebasestorage\.googleapis\.com)\//i.test(
      effectiveSrc
    );

  return (
    <Image
      {...props}
      src={effectiveSrc}
      alt={alt ?? ""}
      className={className}
      unoptimized={isExternal && !isOptimizableExternal}
      onError={() => {
        if (!error) {
          setError(true);
        }
      }}
    />
  );
}
