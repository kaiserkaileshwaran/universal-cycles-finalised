"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Star, Heart, ShoppingCart, Share2,
  Shield, Truck, RotateCcw, Plus, Minus, Check, Zap, Bell, Ruler, MapPin
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ProductCard } from "@/components/products/product-card";
import { useCart } from "@/contexts/cart-context";
import { useWishlist } from "@/contexts/wishlist-context";
import { formatPrice, getDiscountPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useProducts } from "@/contexts/products-context";
import { useReviews } from "@/contexts/reviews-context";
import { useAuth } from "@/contexts/auth-context";
import { requestAuth } from "@/components/auth-modal";
import { recordCustomerInterest, subscribeToStockAlert, isSubscribedToStockAlert } from "@/lib/push-helper";
import { INDIA_STATES, lookupStateByPin } from "@/data/indian-locations";
import { computeShippingFees, productWeightKg } from "@/lib/shipping";
import { useShippingRates } from "@/contexts/shipping-rates-context";
import { useStoreSettings } from "@/contexts/store-settings-context";

const ACCESSORY_CATEGORY_SLUGS = new Set([
  "accessories",
  "helmets",
  "locks",
  "lights",
  "gloves",
  "bottles",
  "pumps",
  "bells",
  "repair-kits",
]);

function formatCmToFeetInches(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

function getFrameSizeRecommendation(heightCm: number, isKidsCycle: boolean) {
  if (isKidsCycle) {
    if (heightCm < 105) {
      return {
        frameSize: '14" Kids Frame',
        wheelSize: '14" Wheels',
        inseamRange: "40–48 cm",
        note: "Ideal for riders aged 3–5 years",
      };
    }
    if (heightCm < 120) {
      return {
        frameSize: '16" Kids Frame',
        wheelSize: '16" Wheels',
        inseamRange: "46–54 cm",
        note: "Ideal for riders aged 5–7 years",
      };
    }
    if (heightCm < 135) {
      return {
        frameSize: '20" Junior Frame',
        wheelSize: '20" Wheels',
        inseamRange: "53–63 cm",
        note: "Ideal for riders aged 7–9 years",
      };
    }
    return {
      frameSize: '24" Youth Frame',
      wheelSize: '24"–26" Wheels',
      inseamRange: "62–72 cm",
      note: "Ideal for riders aged 9–13 years",
    };
  }

  if (heightCm < 158) {
    return {
      frameSize: 'XS (13"–14" / 47 cm)',
      wheelSize: '26" or 27.5" Wheels',
      inseamRange: "66–72 cm",
      note: "Compact standover height for agile control",
    };
  }
  if (heightCm < 168) {
    return {
      frameSize: 'Small (15"–16" / 51 cm)',
      wheelSize: '27.5" or 700c Wheels',
      inseamRange: "71–77 cm",
      note: "Balanced reach for riders 5'2\" to 5'6\"",
    };
  }
  if (heightCm < 178) {
    return {
      frameSize: 'Medium (17"–18" / 54 cm)',
      wheelSize: '27.5", 29" or 700c Wheels',
      inseamRange: "76–82 cm",
      note: "Universal adult geometry for riders 5'6\" to 5'10\"",
    };
  }
  if (heightCm < 188) {
    return {
      frameSize: 'Large (19"–20" / 58 cm)',
      wheelSize: '29" or 700c Wheels',
      inseamRange: "81–88 cm",
      note: "Extended cockpit reach for riders 5'10\" to 6'2\"",
    };
  }
  return {
    frameSize: 'XL (21"–22" / 61 cm)',
    wheelSize: '29" or 700c Wheels',
    inseamRange: "87–95 cm",
    note: "Tall frame geometry for riders above 6'2\"",
  };
}

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;
  const { products, loaded } = useProducts();
  const product = products.find((p) => p.id === productId && p.isActive);
  const { user } = useAuth();

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  
  const [addedToCart, setAddedToCart] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isStockSubscribed, setIsStockSubscribed] = useState(false);
  const [subscribingStock, setSubscribingStock] = useState(false);
  const { reviews, addReview} = useReviews();

  const { addItem, shippingRates } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const { getRate } = useShippingRates();
  const { settings: storeSettings } = useStoreSettings();

  const [riderHeightCm, setRiderHeightCm] = useState<string>("");
  const [pinInput, setPinInput] = useState<string>("");
  const [selectedPinDistrict, setSelectedPinDistrict] = useState<string>("");
  const [pinChecked, setPinChecked] = useState<boolean>(false);

  // Recently viewed products history
  const [recentlyViewed, setRecentlyViewed] = useState<typeof products>([]);

  useEffect(() => {
    if (!productId) return;
    try {
      const STORAGE_KEY = "universal_cycles_recent_views_v1";
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: string[] = stored ? JSON.parse(stored) : [];

      // Find products that were previously viewed (excluding current product)
      const previousIds = parsed.filter((id) => id !== productId);
      const matchingProducts = previousIds
        .map((id) => products.find((p) => p.id === id && p.isActive))
        .filter((p): p is (typeof products)[number] => Boolean(p))
        .slice(0, 4);

      if (matchingProducts.length > 0) {
        setRecentlyViewed((prev) =>
          JSON.stringify(prev.map((p) => p.id)) === JSON.stringify(matchingProducts.map((p) => p.id))
            ? prev
            : matchingProducts
        );
      }

      // Now add current product to front of the viewed list and save
      const updated = [productId, ...parsed.filter((id) => id !== productId)].slice(0, 8);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Record customer interest for smart targeted notifications
      if (product) {
        document.title = `${product.name} | Universal Cycles`;
        if (product.name) recordCustomerInterest(product.name);
        if (product.brand) recordCustomerInterest(product.brand);
        if (product.categoryId) recordCustomerInterest(product.categoryId);
      }

      const nextSub = isSubscribedToStockAlert(productId);
      setIsStockSubscribed((prev) => (prev === nextSub ? prev : nextSub));
    } catch {}
  }, [productId, products, product]);

  if (!product) {
    if (!loaded) {
      return (
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto px-4 md:px-8 lg:px-12 pt-28 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-pulse">
              <div className="aspect-square rounded-2xl bg-muted" />
              <div className="space-y-4">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-10 w-3/4 rounded bg-muted" />
                <div className="h-8 w-1/3 rounded bg-muted" />
                <div className="h-24 w-full rounded bg-muted" />
              </div>
            </div>
          </main>
          <Footer />
        </div>
      );
    }
    return notFound();
  }

  const discountPct = product.salePrice ? getDiscountPercent(product.price, product.salePrice) : 0;
  const wishlisted = isWishlisted(product.id);
  const isAccessory =
    ACCESSORY_CATEGORY_SLUGS.has(product.categoryId) ||
    Boolean(product.subcategoryId && ACCESSORY_CATEGORY_SLUGS.has(product.subcategoryId));
  const isKidsCycle =
    product.categoryId === "kids-bicycles" ||
    product.categoryId === "kids-mountain" ||
    product.subcategoryId === "kids-mountain" ||
    product.subcategoryId === "toddler-bikes";
  const parsedHeightCm = Number(riderHeightCm);
  const frameRecommendation =
    !isAccessory && Number.isFinite(parsedHeightCm) && parsedHeightCm >= 85 && parsedHeightCm <= 220
      ? getFrameSizeRecommendation(parsedHeightCm, isKidsCycle)
      : null;

  const pinLookup = pinChecked || pinInput.trim().length === 6 ? lookupStateByPin(pinInput) : null;
  const pinDistricts = pinLookup?.valid && pinLookup.state ? INDIA_STATES[pinLookup.state] ?? [] : [];
  const activePinDistrict =
    pinLookup?.valid && pinLookup.state
      ? pinDistricts.includes(selectedPinDistrict)
        ? selectedPinDistrict
        : pinDistricts.find((d) => getRate(pinLookup.state!, d) !== undefined) ?? pinDistricts[0] ?? ""
      : "";
  const unitPrice = product.salePrice ?? product.price;
  const lineSubtotal = unitPrice * quantity;
  const isFreeShippingBySubtotal =
    shippingRates.freeShippingMinimum === 0 || lineSubtotal >= shippingRates.freeShippingMinimum;
  const pinDistrictRate =
    pinLookup?.valid && pinLookup.state && activePinDistrict
      ? getRate(pinLookup.state, activePinDistrict)
      : undefined;
  const estimatedPinFees =
    pinLookup?.valid
      ? computeShippingFees({
          cartStandardFee: isFreeShippingBySubtotal ? 0 : shippingRates.standardShippingFee,
          districtRate: pinDistrictRate,
          byWeight: storeSettings.shippingByWeight,
          cartWeightKg: productWeightKg(product) * quantity,
          storeRates: shippingRates,
        })
      : null;
  const relatedProducts = products.filter((p) => p.isActive && p.id !== product.id).slice(0, 4);
  const productReviews = reviews.filter((review) => review.productId === product.id && review.status === 'approved');
  const hasReviewed = user ? productReviews.some(r => r.userId === user.uid) : false;
  const averageReviewRating = productReviews.length ? Math.round((productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length) * 10) / 10 : product.rating;

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const userName = user?.displayName || user?.email?.split('@')[0] || "Anonymous";
    const title = "";
    const comment = String(fields.get("comment") ?? "").trim();
    if (!comment) { setReviewError("Complete your review before submitting."); return; }
    
    const isVerified = user?.providerData?.some(p => p.providerId === 'google.com') || false;
    addReview({ productId: product.id, userId: user?.uid || "browser-customer", userName, rating: reviewRating, title, comment, isVerified, status: 'pending' });
    
    event.currentTarget.reset();
    setReviewError("");
    setReviewMessage("Your review has been submitted and is pending admin approval.");
    setShowReviewForm(false);
  };

  const handleAddToCart = () => {
    addItem(product, { quantity });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    if (product.stock === 0) return;
    addItem(product, { quantity });
    router.push("/checkout");
  };

  const handleShare = async () => {
    const details = { title: product.name, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(details);
        setShareMessage("Product link shared.");
      } else {
        await navigator.clipboard.writeText(details.url);
        setShareMessage("Product link copied.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareMessage("Could not share the link. Copy it from your browser address bar.");
    }
    window.setTimeout(() => setShareMessage(""), 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
      {/* Breadcrumb */}
      <div className="pt-20 lg:pt-24 border-b">
        <div className="container mx-auto px-4 md:px-8 lg:px-12 py-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight size={14} />
            <Link href={`/category/${product.categoryId}`} className="hover:text-primary transition-colors capitalize">
              {product.categoryId.replace(/-/g, " ")}
            </Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 lg:px-12 py-5 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[auto_1fr] gap-5 lg:gap-x-12 xl:gap-x-20 lg:gap-y-5 items-start">
          {/* 1. Product Header (Brand + Name): 1st on Mobile, Top of Right Column on Desktop */}
          <div className="order-1 lg:col-start-2 lg:row-start-1">
            <p className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider mb-1">
              {product.brand}
            </p>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
              {product.name}
            </h1>
          </div>

          {/* 2. Image Gallery: 2nd on Mobile (immediately below Product Name), Left Column on Desktop */}
          <div className="space-y-3 sm:space-y-4 order-2 lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <div className="relative aspect-square rounded-2xl sm:rounded-[32px] overflow-hidden bg-gradient-to-br from-muted/50 to-muted shadow-sm border border-border/50 group">
              <div className="relative w-full h-full">
                <Image
                  src={product.images[selectedImage] ?? product.thumbnail}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 92vw, (max-width: 1023px) 640px, 50vw"
                  quality={75}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                  fetchPriority="high"
                />
              </div>
              

              {product.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage((prev) => (prev === 0 ? product.images.length - 1 : prev - 1))}
                    className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-background/85 backdrop-blur-md flex items-center justify-center shadow-md sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:scale-110 z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={20} className="text-foreground" />
                  </button>
                  <button
                    onClick={() => setSelectedImage((prev) => (prev === product.images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-background/85 backdrop-blur-md flex items-center justify-center shadow-md sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:scale-110 z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight size={20} className="text-foreground" />
                  </button>
                </>
              )}

              {discountPct > 0 && (
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-destructive text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full z-10">
                  -{discountPct}% OFF
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all",
                      selectedImage === i ? "border-primary" : "border-transparent hover:border-border"
                    )}
                  >
                    <Image src={img} alt={`View ${i + 1}`} fill sizes="80px" quality={60} loading="lazy" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Product Details (Ratings, Price, Stock, Actions): 3rd on Mobile (below Images), Right Column Body on Desktop */}
          <div className="space-y-5 sm:space-y-6 order-3 lg:col-start-2 lg:row-start-2">
            {/* Rating */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    className={
                      i < Math.floor(product.rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted"
                    }
                  />
                ))}
              </div>
              <span className="text-sm font-medium">{product.rating}</span>
              <span className="text-sm text-muted-foreground">
                ({product.reviewsCount} reviews)
              </span>
              {user ? (hasReviewed ? <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">You reviewed this</span> : <button type="button" onClick={() => { setShowReviewForm(true); setReviewMessage(""); setReviewError(""); document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" }); }} className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95">Write a review</button>) : <Link href="/login" className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95">Log in to review</Link>}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="text-3xl md:text-4xl font-bold text-primary">
                {formatPrice(product.salePrice ?? product.price)}
              </span>
              {product.salePrice && (
                <>
                  <span className="text-xl text-muted-foreground line-through">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-sm font-bold text-green-800 bg-green-100 dark:bg-green-950 dark:text-green-300 px-2 py-1 rounded-lg">
                    Save {formatPrice(product.price - product.salePrice)}
                  </span>
                </>
              )}
            </div>

            {/* Stock Status & Scarcity Urgency */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", product.stock === 0 ? "bg-red-500" : product.stock <= 3 ? "bg-amber-500 animate-pulse ring-4 ring-amber-500/20" : "bg-green-600")} />
              <span className={cn("text-sm font-semibold", product.stock === 0 ? "text-destructive" : product.stock <= 3 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400")}>
                {product.stock === 0
                  ? "Currently Out of Stock"
                  : product.stock <= 3
                  ? `Only ${product.stock} bike${product.stock > 1 ? "s" : ""} left in stock — Order soon!`
                  : "In Stock — Ready for Dispatch"}
              </span>
              {product.stock > 0 && product.stock <= 3 && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  Low Stock
                </span>
              )}
            </div>

            {/* Short Description */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed py-2">{product.description}</p>

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex items-center border border-border rounded-xl overflow-hidden shrink-0 ${product.stock === 0 ? "opacity-50 pointer-events-none" : ""}`}>
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-11 h-12 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-11 h-12 flex items-center justify-center hover:bg-muted transition-colors"
                    disabled={quantity >= product.stock}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <motion.button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  aria-label={product.stock === 0 ? "Out of stock" : addedToCart ? "Added to cart" : "Add to cart"}
                  className={cn(
                    "flex-1 min-w-[155px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-base transition-all disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-muted",
                    addedToCart
                      ? "bg-green-700 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  whileTap={{ scale: 0.98 }}
                >
                  <AnimatePresence mode="wait">
                    {addedToCart ? (
                      <motion.span
                        key="check"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-2"
                      >
                        <Check size={18} />
                        <span>Added to Cart</span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="cart"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-2"
                      >
                        <ShoppingCart size={18} />
                        <span>Add to Cart</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                <button
                  onClick={() => { if (!user) return requestAuth("Sign in to save items", "Create an account or sign in to build your wishlist and save your favorite products for later."); toggleWishlist(product.id); }}
                  className={cn(
                    "w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all shrink-0",
                    wishlisted
                      ? "border-red-300 bg-red-50 text-red-500"
                      : "border-border hover:border-red-300 hover:text-red-400"
                  )}
                  aria-label="Toggle wishlist"
                >
                  <Heart size={20} className={wishlisted ? "fill-red-500" : ""} />
                </button>

                <button
                  className="w-12 h-12 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary hover:text-primary transition-all shrink-0"
                  aria-label="Share"
                  onClick={handleShare}
                >
                  <Share2 size={20} />
                </button>
              </div>
              {shareMessage && <p role="status" className="text-sm text-muted-foreground">{shareMessage}</p>}

              {product.stock === 0 ? (
                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (isStockSubscribed) return;
                      setSubscribingStock(true);
                      const res = await subscribeToStockAlert(product.id);
                      setSubscribingStock(false);
                      if (res.success) {
                        setIsStockSubscribed(true);
                      }
                    }}
                    disabled={subscribingStock}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-base transition-all shadow-md active:scale-[0.99]",
                      isStockSubscribed
                        ? "bg-green-600 text-white cursor-default"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {isStockSubscribed ? (
                      <>
                        <Check size={18} /> Subscribed! We will notify you
                      </>
                    ) : subscribingStock ? (
                      "Setting restock alert..."
                    ) : (
                      <>
                        <Bell size={18} /> Notify Me When In Stock
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-muted-foreground">
                    Get an instant free push notification the moment this cycle is back in stock.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-all bg-accent text-accent-foreground hover:bg-accent/90 shadow-md hover:shadow-lg active:scale-[0.99]"
                >
                  <Zap size={18} /> Buy Now (Instant Checkout)
                </button>
              )}
            </div>

            {/* 1. Rider Height -> Frame Size Calculator (For Bicycles) */}
            {!isAccessory && (
              <div
                data-testid="frame-size-calculator"
                className="rounded-2xl border border-border bg-card/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Ruler size={18} className="text-primary shrink-0" />
                    <label htmlFor="rider-height-cm" className="text-sm font-bold">
                      Find Your Frame Size (Rider Height)
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(isKidsCycle ? [100, 115, 130, 142] : [155, 165, 175, 185]).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setRiderHeightCm(String(h))}
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs font-semibold border transition-colors",
                          Number(riderHeightCm) === h
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/50"
                        )}
                      >
                        {h} cm ({formatCmToFeetInches(h)})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    id="rider-height-cm"
                    type="number"
                    min={85}
                    max={220}
                    placeholder={isKidsCycle ? "Enter rider height in cm (e.g. 120)" : "Enter rider height in cm (e.g. 172)"}
                    value={riderHeightCm}
                    onChange={(e) => setRiderHeightCm(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {parsedHeightCm >= 85 && parsedHeightCm <= 220 && (
                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap px-2.5 py-2 rounded-lg bg-muted">
                      ≈ {formatCmToFeetInches(parsedHeightCm)}
                    </span>
                  )}
                </div>

                {frameRecommendation && (
                  <div
                    data-testid="frame-size-result"
                    className="rounded-xl bg-primary/10 border border-primary/25 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-foreground">
                        Recommended Size:{" "}
                        <span className="text-primary font-extrabold">{frameRecommendation.frameSize}</span>
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        {frameRecommendation.wheelSize} · Inseam {frameRecommendation.inseamRange}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{frameRecommendation.note}</p>
                  </div>
                )}
              </div>
            )}

            {/* 5. PIN Code Delivery & Shipping Fee Estimator */}
            <div
              data-testid="pincode-estimator"
              className="rounded-2xl border border-border bg-card/60 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-primary shrink-0" />
                  <label htmlFor="delivery-pincode" className="text-sm font-bold">
                    Check Delivery & Shipping Fee by PIN Code
                  </label>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {productWeightKg(product)} kg/unit
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  id="delivery-pincode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit Indian PIN code (e.g. 638001)"
                  value={pinInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPinInput(digits);
                    if (digits.length < 6) setPinChecked(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setPinChecked(true);
                    }
                  }}
                  className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  data-testid="check-pincode-btn"
                  onClick={() => setPinChecked(true)}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                >
                  Check
                </button>
              </div>

              {pinLookup && !pinLookup.valid && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {pinLookup.reason}
                </p>
              )}

              {pinLookup?.valid && pinLookup.state && estimatedPinFees && (
                <div
                  data-testid="pincode-result"
                  className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">
                      Delivering to {pinLookup.state} ({pinInput})
                    </span>
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Est. {pinLookup.etaDays}
                    </span>
                  </div>

                  {pinDistricts.length > 1 && (
                    <div className="flex items-center gap-2">
                      <label htmlFor="pin-district-select" className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                        District:
                      </label>
                      <select
                        id="pin-district-select"
                        value={activePinDistrict}
                        onChange={(e) => setSelectedPinDistrict(e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium"
                      >
                        {pinDistricts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-500/20">
                    <span className="font-semibold text-foreground">
                      Standard Shipping ({quantity} {quantity === 1 ? "unit" : "units"}):{" "}
                      <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                        {estimatedPinFees.standard === 0 ? "FREE Delivery" : formatPrice(estimatedPinFees.standard)}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      COD & Online Pay Available
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 border border-border rounded-2xl p-4">
              {[
                { icon: <Truck size={20} />, title: "Shipping", desc: shippingRates.freeShippingMinimum === 0 ? "Free standard delivery" : `Free above ${formatPrice(shippingRates.freeShippingMinimum)}` },
                { icon: <RotateCcw size={20} />, title: "Cash on Delivery", desc: "Available at checkout" },
                { icon: <Shield size={20} />, title: "Warranty", desc: product.warrantyInfo ?? "1 year" },
              ].map((badge) => (
                <div key={badge.title} className="flex flex-col items-center text-center gap-1.5">
                  <div className="text-primary">{badge.icon}</div>
                  <p className="text-xs font-semibold">{badge.title}</p>
                  <p className="text-xs text-muted-foreground">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

                {/* Sections: Description / Specs / Reviews */}
        <div className="mt-16 md:mt-24">
          
          <div className="space-y-16">
            
            {/* Description & Key Features */}
            <div className="border border-border rounded-2xl p-6 md:p-8 bg-card/50 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-3">{product.name} Details</h2>
                <p className="text-muted-foreground leading-relaxed text-base md:text-lg">
                  {product.description}
                </p>
              </div>
              
              {product.features && product.features.length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Key Features</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {product.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check size={20} className="text-green-600 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Specifications */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Specifications</h2>
              <div className="border border-border rounded-2xl overflow-hidden">
                {Object.entries(product.specifications ?? {}).map(([key, value], i) => (
                  <div
                    key={key}
                    className={cn(
                      "grid grid-cols-2 p-4 gap-4",
                      i % 2 === 0 ? "bg-muted/30" : "bg-background"
                    )}
                  >
                    <span className="text-sm font-semibold">{key}</span>
                    <span className="text-sm text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div id="reviews" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
                {!hasReviewed && user && (
                  <button type="button" onClick={() => { setShowReviewForm(true); setReviewMessage(""); setReviewError(""); }} className="text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-6 py-2.5 rounded-xl mb-6 transition-all shadow-sm active:scale-95">
                    Write a review
                  </button>
                )}
              </div>
                {/* Rating Summary */}
                <div className="flex items-center gap-6 p-6 bg-muted/30 rounded-2xl">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-primary">{productReviews.length ? averageReviewRating.toFixed(1) : product.rating}</p>
                    <div className="flex justify-center mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{productReviews.length} customer reviews</p>
                  </div>
                  {productReviews.length > 0 ? <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-xs w-3">{n}</span>
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-400 h-2 rounded-full"
                            style={{ width: `${productReviews.filter((review) => review.rating === n).length / productReviews.length * 100}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-xs text-muted-foreground">{productReviews.filter((review) => review.rating === n).length}</span>
                      </div>
                    ))}
                  </div> : <p className="flex-1 text-sm text-muted-foreground">Be the first customer to leave a review for this product.</p>}
                </div>

                {reviewMessage && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{reviewMessage}</p>}
                {showReviewForm && <form onSubmit={submitReview} className="space-y-4 rounded-2xl border border-border bg-card p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Write a review</h3><button type="button" onClick={() => setShowReviewForm(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button></div>
                  {reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}
                  <fieldset><legend className="mb-2 text-sm font-medium">Your rating</legend><div className="flex gap-1">{[1,2,3,4,5].map((rating) => <button key={rating} type="button" aria-label={`${rating} star${rating === 1 ? "" : "s"}`} aria-pressed={reviewRating === rating} onClick={() => setReviewRating(rating)}><Star size={24} className={rating <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted"}/></button>)}</div></fieldset>
                  <label className="block space-y-2 text-sm font-medium">Your review<textarea name="comment" required maxLength={1500} rows={4} className="w-full rounded-xl border border-border bg-background px-3 py-2.5"/></label>
                  <button type="submit" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Submit review</button>
                </form>}

                {/* Review List */}
                {productReviews.map((review) => (
                  <div key={review.id} className="p-6 border border-border rounded-2xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{review.userName}</p>
                          {review.isVerified && <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1"><Check size={10}/> Verified with Google Account</span>}
                        </div>
                        <div className="flex mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted"}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    
                    <p className="text-muted-foreground text-sm leading-relaxed">{review.comment}</p>
                    
                  </div>
                ))}
          </div>
        </div>
        </div>

        {/* Related Products */}
        <div className="mt-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recently Viewed Cycles - Only shown if user has previously viewed cycles */}
        {recentlyViewed.length > 0 && (
          <div className="mt-20 pt-16 border-t border-border">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold">Recently Viewed Cycles</h2>
              <p className="text-muted-foreground text-sm mt-1">Bicycles you previously inspected</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentlyViewed.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
      </main>

      <Footer />
    </div>
  );
}
