"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, MapPin, CreditCard, Truck, CheckCircle, Gift, FileText, ShoppingBag, AlertCircle, Tag } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useCart } from "@/contexts/cart-context";
import { usePromotions, isPromotionEligible, getPromotionValueLabel } from "@/contexts/promotions-context";
import { useAuth } from "@/contexts/auth-context";
import { formatPrice } from "@/lib/utils";
import { SafeImage as Image } from "@/components/ui/safe-image";
import { useOrders } from "@/contexts/orders-context";
import { useProducts } from "@/contexts/products-context";
import { generateId } from "@/lib/utils";
import type { Order } from "@/types";
import { useAddresses } from "@/contexts/addresses-context";
import { sendPushNotification } from "@/lib/push-helper";
import { useStoreSettings } from "@/contexts/store-settings-context";
import { cartWeightKg, computeShippingFees } from "@/lib/shipping";
import { useShippingRates } from "@/contexts/shipping-rates-context";
import { INDIA_STATES, INDIA_STATE_NAMES, isValidIndianPhone, isValidIndianPinForState } from "@/data/indian-locations";
import { buildUpiLink, getActiveRazorpayKeyId, isOnlinePaymentConfigured, isValidUpiId, launchRazorpayCheckout, normalizePaymentUrl } from "@/lib/payments";

type CheckoutStep = "address" | "shipping" | "payment" | "review";

const STEPS: { id: CheckoutStep; label: string; icon: React.ReactNode }[] = [
  { id: "address", label: "Address", icon: <MapPin size={16} /> },
  { id: "shipping", label: "Shipping", icon: <Truck size={16} /> },
  { id: "payment", label: "Payment", icon: <CreditCard size={16} /> },
  { id: "review", label: "Review", icon: <CheckCircle size={16} /> },
];

export default function CheckoutPage() {
  const { state, subtotal, discount, shipping, shippingRates, applyCoupon, removeCoupon, clearCart } = useCart();
  const { promotions } = usePromotions();
  const { user } = useAuth();
  const { addOrder, updateOrder } = useOrders();
  const { products, deductStockForOrder } = useProducts();
  const { ready: addressesReady, getAddresses, saveAddress } = useAddresses();
  const { settings: storeSettings } = useStoreSettings();
  const { getRate } = useShippingRates();

  const [step, setStep] = useState<CheckoutStep>("address");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const placingRef = useRef(false);
  const [utrInput, setUtrInput] = useState("");
  const [utrSaved, setUtrSaved] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  const handleApplyCoupon = (overrideCode?: string) => {
    const code = (overrideCode || couponInput).trim().toUpperCase();
    if (!code) return;
    const promo = promotions.find((p) => p.code.toLowerCase() === code.toLowerCase() && p.isActive);
    const requiredMin = promo ? Math.max(promo.minimum || 0, promo.kind === "fixed" ? promo.value : 0) : 0;
    if (promo && subtotal >= requiredMin) {
      applyCoupon(code, 0);
      setCouponSuccess(promo.kind === "shipping" ? "Free standard shipping applied." : "Coupon applied to your order.");
      setCouponError("");
    } else if (promo) {
      setCouponError(`Add ${formatPrice(requiredMin - subtotal)} more to use ${code}.`);
      setCouponSuccess("");
    } else {
      setCouponError("That code isn’t valid. Check the available offers and try again.");
      setCouponSuccess("");
    }
  };

  useEffect(() => {
    document.title = "Checkout | Universal Cycles";
  }, []);

  const [address, setAddress] = useState({
    fullName: user?.displayName ?? "",
    email: user?.email ?? "",
    phone: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    district: "",
    country: "India",
    zipCode: "",
  });
  const [saveDeliveryAddress, setSaveDeliveryAddress] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const savedAddresses = user ? getAddresses(user.uid) : [];
  const [shippingMethod, setShippingMethod] = useState("standard");
  const onlinePaymentAvailable = isOnlinePaymentConfigured(storeSettings);
  const [chosenPayment, setChosenPayment] = useState<"cod" | "upi">("cod");
  const paymentMethod: "cod" | "upi" = onlinePaymentAvailable ? chosenPayment : "cod";
  const [placedPayment, setPlacedPayment] = useState<{ method: "cod" | "upi"; amount: number } | null>(null);
  const [giftWrap, setGiftWrap] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  const totalWeightKg = cartWeightKg(state.items);
  const districtRate = getRate(address.state, address.district);
  const weightBilled = storeSettings.shippingByWeight && districtRate !== undefined;
  // Regional rate: the admin can set a standard fee per district. Express/Priority keep their surcharge on top of it.
  const { standard: standardFee, express: expressFee, overnight: overnightFee } = computeShippingFees({
    cartStandardFee: shipping,
    districtRate,
    byWeight: storeSettings.shippingByWeight,
    cartWeightKg: totalWeightKg,
    storeRates: shippingRates,
  });
  const selectedShipping = shippingMethod === "overnight" ? overnightFee : shippingMethod === "express" ? expressFee : standardFee;
  const orderTotal = Math.max(0, subtotal - discount + selectedShipping + (giftWrap ? 499 : 0));

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    if (!user) return;
    setAddress((prev) => ({
      ...prev,
      fullName: prev.fullName || user.displayName || "",
      email: prev.email || user.email || "",
    }));
  }, [user]);

  useEffect(() => {
    if (!user || !addressesReady) return;
    const addrs = getAddresses(user.uid);
    if (addrs.length === 0) {
      setShowAddressForm(true);
      return;
    }
    const defaultAddress = addrs.find((saved) => saved.isDefault) || addrs[0];
    if (!defaultAddress) return;
    // Pre-fill the signed-in customer's saved default delivery address if not yet filled.
    if (!address.street1) {
      setAddress({
        fullName: defaultAddress.fullName || user.displayName || "",
        email: user.email || address.email || "",
        phone: defaultAddress.phone,
        street1: defaultAddress.street1,
        street2: defaultAddress.street2 ?? "",
        city: defaultAddress.city,
        state: defaultAddress.state,
        district: defaultAddress.district ?? "",
        country: defaultAddress.country || "India",
        zipCode: defaultAddress.zipCode,
      });
      setShowAddressForm(false);
    }
  }, [address.email, address.street1, addressesReady, getAddresses, user]);

  const handlePlaceOrder = async () => {
    if (placingRef.current || isPlacing) return;
    placingRef.current = true;
    setIsPlacing(true);
    setCheckoutError("");
    const missingStock = state.items.find((item) => {
      const latest = products.find((product) => product.id === item.product.id);
      return !latest || !latest.isActive || latest.stock < item.quantity;
    });
    if (missingStock) {
      setCheckoutError(`${missingStock.product.name} is no longer available in the requested quantity. Update your cart and try again.`);
      setIsPlacing(false);
      placingRef.current = false;
      return;
    }
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const nextOrderId = `UC${Date.now().toString().slice(-6)}${randomSuffix}`;
    const order: Order = {
      id: nextOrderId,
      userId: user?.uid ?? "guest",
      email: address.email.trim(),
      status: "pending",
      items: state.items.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        thumbnail: item.product.thumbnail,
      })),
      subtotal,
      tax: 0,
      shippingFee: selectedShipping,
      discount,
      giftWrap,
      giftWrapFee: giftWrap ? 499 : 0,
      totalWeightKg: Number(totalWeightKg.toFixed(2)),
      total: orderTotal,
      shippingAddress: {
        id: generateId(),
        label: "Delivery",
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        street1: address.street1.trim(),
        street2: address.street2.trim() || undefined,
        city: address.city.trim(),
        state: address.state.trim(),
        district: address.district.trim(),
        country: address.country.trim(),
        zipCode: address.zipCode.trim(),
        isDefault: false,
      },
      paymentMethod,
      paymentStatus: "pending",
      stockDeducted: true,
      orderNotes: orderNotes.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const stockItems = order.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      setCheckoutError(
        `No internet connection detected. Your order #${nextOrderId} is saved locally and will be submitted automatically as soon as your connection returns.`
      );
      await addOrder(order);
      setCheckoutError("");
      await deductStockForOrder(nextOrderId, stockItems);
    } else {
      // Atomically allocate stock BEFORE creating the order or initiating payment so concurrent buyers cannot oversell the last unit.
      const stockAllocated = await deductStockForOrder(nextOrderId, stockItems);
      if (!stockAllocated) {
        setCheckoutError(
          "Payment & order cancelled: one or more items in your cart are out of stock and no longer available in the requested quantity. Update your cart and try again."
        );
        setIsPlacing(false);
        placingRef.current = false;
        return;
      }
      await addOrder(order);
      setCheckoutError("");
    }
    if (user && saveDeliveryAddress) saveAddress(user.uid, order.shippingAddress);
    for (const ordered of order.items) {
      const product = products.find((p) => p.id === ordered.productId);
      if (!product) continue;
      const newStock = Math.max(0, product.stock - ordered.quantity);
      if (newStock === 0) {
        sendPushNotification(
          `🚨 OUT OF STOCK: ${product.name}`,
          `"${product.name}" has run OUT OF STOCK (Order #${order.id}). Tap to restock now!`,
          `/admin/products`
        );
      } else if (newStock <= 3) {
        sendPushNotification(
          `⚠️ LOW STOCK: ${product.name}`,
          `Only ${newStock} unit(s) remaining for "${product.name}" after Order #${order.id}.`,
          `/admin/products`
        );
      }
    }
    setOrderId(nextOrderId);
    setPlacedPayment({ method: paymentMethod, amount: orderTotal });
    clearCart();
    setOrderPlaced(true);
    setIsPlacing(false);

    const activeGatewayKeyId = getActiveRazorpayKeyId(storeSettings);
    if (paymentMethod === "upi" && activeGatewayKeyId) {
      launchRazorpayCheckout({
        keyId: activeGatewayKeyId,
        orderId: nextOrderId,
        amountInr: orderTotal,
        storeName: storeSettings.storeName,
        customerName: address.fullName,
        customerEmail: address.email,
        customerPhone: address.phone,
        onSuccess: async ({ paymentId, verified }) => {
          setUtrInput(paymentId);
          await updateOrder(nextOrderId, {
            paymentReference: paymentId,
            updatedAt: Date.now(),
          });
          if (verified) {
            await updateOrder(nextOrderId, {
              paymentStatus: "paid",
              updatedAt: Date.now(),
            });
          }
          setUtrSaved(true);
        },
      });
    }
  };

  const continueFromAddress = () => {
    const required = [address.fullName, address.email, address.phone, address.street1, address.city, address.state, address.country, address.zipCode];
    if (required.some((value) => !value.trim())) {
      setCheckoutError("Complete all required delivery details to continue.");
      return;
    }
    if (!INDIA_STATES[address.state] || !INDIA_STATES[address.state].includes(address.district)) {
      setShowAddressForm(true);
      setCheckoutError("Select your state and district so we can calculate delivery.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(address.email.trim())) {
      setCheckoutError("Enter a valid email address for your order confirmation.");
      return;
    }
    if (!isValidIndianPhone(address.phone)) {
      setCheckoutError("Enter a valid phone number (10-digit Indian mobile number starting with 6–9).");
      return;
    }
    const pinCheck = isValidIndianPinForState(address.zipCode, address.state);
    if (!pinCheck.valid) {
      setShowAddressForm(true);
      setCheckoutError(pinCheck.reason || "Enter a valid 6-digit Indian PIN code.");
      return;
    }
    if (user && (saveDeliveryAddress || savedAddresses.length === 0)) {
      saveAddress(user.uid, {
        id: generateId(),
        label: savedAddresses.length === 0 ? "Home" : "Delivery",
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        street1: address.street1.trim(),
        street2: address.street2.trim() || undefined,
        city: address.city.trim(),
        state: address.state.trim(),
        district: address.district.trim(),
        country: address.country.trim() || "India",
        zipCode: address.zipCode.trim(),
        isDefault: savedAddresses.length === 0,
      });
      setShowAddressForm(false);
    }
    setCheckoutError("");
    setStep("shipping");
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 pt-28 pb-16 md:pt-32 md:pb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg mx-auto bg-card border border-border rounded-3xl p-6 sm:p-8 md:p-10 text-center shadow-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.15 }}
              className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"
            >
              <CheckCircle size={44} className="text-green-600" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2.5">Order Placed!</h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
              {placedPayment?.method === "upi"
                ? "Thank you for your order. Complete your online payment below so we can confirm it quickly."
                : "Thank you for your order. Your order details have been saved and payment is due on delivery."}
            </p>
            <div className="mb-6">
              <span className="text-sm font-mono font-bold bg-muted px-4 py-2 rounded-xl inline-block border border-border">
                Order #{orderId}
              </span>
            </div>
            {placedPayment?.method === "upi" && orderId && (() => {
              const gatewayKeyId = getActiveRazorpayKeyId(storeSettings);
              const payUrl = normalizePaymentUrl(storeSettings.razorpayPaymentUrl);
              const upiOk = isValidUpiId(storeSettings.razorpayUpiId);
              return (
                <div className="mb-6 space-y-3 rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 text-left">
                  <p className="text-sm font-semibold">Amount to pay: {formatPrice(placedPayment.amount)}</p>
                  <div className="flex flex-col gap-2">
                    {gatewayKeyId && (
                      <button
                        type="button"
                        onClick={() =>
                          launchRazorpayCheckout({
                            keyId: gatewayKeyId,
                            orderId,
                            amountInr: placedPayment.amount,
                            storeName: storeSettings.storeName,
                            customerName: address.fullName,
                            customerEmail: address.email,
                            customerPhone: address.phone,
                            onSuccess: async ({ paymentId, verified }) => {
                              setUtrInput(paymentId);
                              await updateOrder(orderId, {
                                paymentReference: paymentId,
                                updatedAt: Date.now(),
                              });
                              if (verified) {
                                await updateOrder(orderId, {
                                  paymentStatus: "paid",
                                  updatedAt: Date.now(),
                                });
                              }
                              setUtrSaved(true);
                            },
                          })
                        }
                        className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Pay with Razorpay
                      </button>
                    )}
                    {payUrl && <a href={payUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90">Pay with Razorpay</a>}
                    {upiOk && <a href={buildUpiLink(storeSettings.razorpayUpiId, storeSettings.storeName, placedPayment.amount, `Order ${orderId}`)} className="rounded-xl border border-primary px-5 py-3 text-center text-sm font-semibold text-primary hover:bg-primary/5">Pay with UPI app</a>}
                  </div>
                  {upiOk && <p className="text-xs text-muted-foreground break-all">UPI ID: <span className="font-mono">{storeSettings.razorpayUpiId}</span></p>}
                  <p className="text-xs text-muted-foreground leading-relaxed">Mention order #{orderId} in the payment note. You can also pay or submit your UTR reference anytime on the Track Order page.</p>
                  <div className="pt-2 border-t border-border">
                    <label htmlFor="checkout-utr" className="block text-xs font-semibold mb-1.5">Already paid? Enter UTR / Transaction ID (optional)</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="checkout-utr"
                        type="text"
                        value={utrInput}
                        onChange={(e) => { setUtrInput(e.target.value); setUtrSaved(false); }}
                        placeholder="e.g. 12-digit UPI UTR or Razorpay ID"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (utrInput.trim().length < 4) return;
                          await updateOrder(orderId, { paymentReference: utrInput.trim(), updatedAt: Date.now() });
                          setUtrSaved(true);
                        }}
                        className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shrink-0"
                      >
                        {utrSaved ? "Saved ✓" : "Submit UTR"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={user ? "/track-order" : `/track-order?orderId=${orderId}`}
                className="flex-1 bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors text-center whitespace-nowrap"
              >
                Track Order
              </Link>
              <Link
                href="/"
                className="flex-1 border border-border px-6 py-3.5 rounded-xl font-semibold hover:bg-muted transition-colors text-center whitespace-nowrap"
              >
                Continue Shopping
              </Link>
            </div>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 pt-24 text-center">
          {checkoutError && (
            <div role="alert" className="mb-6 flex max-w-md items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-left text-sm text-destructive">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{checkoutError}</p>
            </div>
          )}
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBag size={28} />
          </div>
          <h1 className="text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Add something you love before starting checkout.</p>
          <Link href="/category/all" className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90">Browse products</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <div className="container mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-12 max-w-6xl">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-primary">Home</Link>
            <ChevronRight size={14} />
            <Link href="/cart" className="hover:text-primary">Cart</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Checkout</span>
          </nav>

          <h1 className="text-3xl md:text-4xl font-bold mb-8">Checkout</h1>

          {checkoutError && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{checkoutError}</p>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center mb-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
                <div
                  className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                    stepIndex >= i ? "text-primary" : "text-muted-foreground"
                  }`}
                  onClick={() => stepIndex > i && setStep(s.id)}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      stepIndex > i
                        ? "bg-primary text-primary-foreground"
                        : stepIndex === i
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {stepIndex > i ? <CheckCircle size={16} /> : s.icon}
                  </div>
                  <span className="hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 sm:mx-3 ${stepIndex > i ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Main Content: 2nd on Mobile (below Order Summary), Left 2 Columns on Desktop */}
            <div className="order-2 lg:order-1 lg:col-span-2">
              <AnimatePresence mode="wait">
                {step === "address" && (
                  <motion.div
                    key="address"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-card border border-border rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">Delivery Address</h2>
                      {savedAddresses.length > 0 && showAddressForm && (
                        <button type="button" onClick={() => setShowAddressForm(false)} className="text-sm font-semibold text-primary hover:underline">
                          Use Saved Address
                        </button>
                      )}
                      {savedAddresses.length > 0 && !showAddressForm && (
                        <button type="button" onClick={() => setShowAddressForm(true)} className="text-sm font-semibold text-primary hover:underline">
                          + Add New Address
                        </button>
                      )}
                    </div>

                    {!showAddressForm && savedAddresses.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {savedAddresses.map((saved) => (
                          <div 
                            key={saved.id} 
                            onClick={() => setAddress({ fullName: saved.fullName, email: address.email || user?.email || "", phone: saved.phone, street1: saved.street1, street2: saved.street2 ?? "", city: saved.city, state: saved.state, district: saved.district ?? "", country: saved.country, zipCode: saved.zipCode })}
                            className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative ${address.street1 === saved.street1 ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                          >
                            {address.street1 === saved.street1 && (
                              <div className="absolute top-4 right-4 text-primary">
                                <CheckCircle size={20} className="fill-primary/20" />
                              </div>
                            )}
                            <p className="font-bold text-base mb-1">
                              {saved.label} {saved.isDefault && <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-2 align-middle">Default</span>}
                            </p>
                            <p className="text-sm font-medium mb-2">{saved.fullName} · {saved.phone}</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {saved.street1}{saved.street2 ? `, ${saved.street2}` : ""}<br/>
                              {saved.city}, {saved.state} {saved.zipCode}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            { label: "Full Name", key: "fullName", placeholder: "John Doe" },
                            { label: "Email", key: "email", placeholder: "you@example.com", type: "email" },
                            { label: "Phone", key: "phone", placeholder: "9876543210", type: "tel" },
                            { label: "Country", key: "country", placeholder: "India" },
                            { label: "Street Address", key: "street1", placeholder: "12, Market Street" },
                            { label: "Apt / Suite (optional)", key: "street2", placeholder: "House No. 4" },
                            { label: "City", key: "city", placeholder: "Erode" },
                            { label: "ZIP Code", key: "zipCode", placeholder: "638001" },
                          ].map(({ label, key, placeholder, type }) => (
                            <div key={key} className={key === "street1" || key === "email" ? "sm:col-span-2" : ""}>
                              <label htmlFor={`checkout-${key}`} className="block text-sm font-medium mb-1">{label}{key !== "street2" && " *"}</label>
                              <input
                                id={`checkout-${key}`}
                                type={type ?? "text"}
                                required={key !== "street2"}
                                autoComplete={key === "fullName" ? "name" : key === "email" ? "email" : key === "phone" ? "tel" : key === "street1" ? "street-address" : undefined}
                                placeholder={placeholder}
                                value={address[key as keyof typeof address]}
                                onChange={(e) => setAddress((prev) => ({ ...prev, [key]: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                              />
                            </div>
                          ))}
                          <div>
                            <label htmlFor="checkout-state" className="block text-sm font-medium mb-1">State *</label>
                            <select
                              id="checkout-state"
                              required
                              autoComplete="address-level1"
                              value={address.state}
                              onChange={(e) => setAddress((prev) => ({ ...prev, state: e.target.value, district: "" }))}
                              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                            >
                              <option value="">Select state</option>
                              {INDIA_STATE_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="checkout-district" className="block text-sm font-medium mb-1">District *</label>
                            <select
                              id="checkout-district"
                              required
                              disabled={!address.state}
                              value={address.district}
                              onChange={(e) => setAddress((prev) => ({ ...prev, district: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm disabled:opacity-60"
                            >
                              <option value="">{address.state ? "Select district" : "Select a state first"}</option>
                              {(INDIA_STATES[address.state] ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </div>
                        </div>
                        {user && (
                          <label className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                            <input type="checkbox" checked={saveDeliveryAddress} onChange={(event) => setSaveDeliveryAddress(event.target.checked)} className="accent-primary"/>
                            Save this delivery address to my account on this device
                          </label>
                        )}
                      </>
                    )}

                    {/* Gift Wrap & Notes */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={giftWrap}
                          onChange={(e) => setGiftWrap(e.target.checked)}
                          className="rounded accent-primary"
                        />
                        <div className="flex items-center gap-2">
                          <Gift size={16} className="text-primary" />
                          <span className="text-sm font-medium">Add gift wrapping (+₹499)</span>
                        </div>
                      </label>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-2">
                          <FileText size={16} className="text-muted-foreground" />
                          Order Notes (optional)
                        </label>
                        <textarea
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          placeholder="Any special instructions for your order..."
                          rows={2}
                          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={continueFromAddress}
                      className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Continue to Shipping
                    </button>
                  </motion.div>
                )}

                {step === "shipping" && (
                  <motion.div
                    key="shipping"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-card border border-border rounded-2xl p-6 space-y-4"
                  >
                    <h2 className="text-xl font-bold">Shipping Method</h2>
                    <div className="space-y-3">
                      {[
                        { id: "standard", label: "Standard Delivery", desc: weightBilled ? `5-7 business days · ${Number(totalWeightKg.toFixed(2))} kg × ${formatPrice(districtRate ?? 0)}/kg` : "5-7 business days", price: standardFee === 0 ? "FREE" : formatPrice(standardFee) },
                        { id: "express", label: "Express Delivery", desc: "2-3 business days", price: formatPrice(expressFee) },
                        { id: "overnight", label: "Priority Delivery", desc: "Next business day", price: formatPrice(overnightFee) },
                      ].map((method) => (
                        <label key={method.id} className="flex items-center gap-4 p-4 border-2 border-border rounded-xl cursor-pointer hover:border-primary transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <input
                            type="radio"
                            name="shipping"
                            value={method.id}
                            checked={shippingMethod === method.id}
                            onChange={() => setShippingMethod(method.id)}
                            className="accent-primary"
                          />
                          <div className="flex-1">
                            <p className="font-semibold">{method.label}</p>
                            <p className="text-sm text-muted-foreground">{method.desc}</p>
                          </div>
                          <span className={`font-bold ${method.price === "FREE" ? "text-green-700 dark:text-green-400" : ""}`}>
                            {method.price}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setStep("address")}
                        className="flex-1 py-4 rounded-xl border border-border font-semibold hover:bg-muted transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setStep("payment")}
                        className="flex-1 bg-primary text-primary-foreground py-4 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                      >
                        Continue to Payment
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "payment" && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-card border border-border rounded-2xl p-6 space-y-4"
                  >
                    <h2 className="text-xl font-bold">Payment Method</h2>
                    {onlinePaymentAvailable && (
                      <button type="button" onClick={() => setChosenPayment("upi")} aria-pressed={paymentMethod === "upi"} className={`w-full rounded-2xl border-2 p-5 text-left transition-colors ${paymentMethod === "upi" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><CreditCard size={19} /></div>
                          <div>
                            <p className="font-semibold">Pay Online (UPI / Razorpay)</p>
                            <p className="mt-1 text-sm text-muted-foreground">Pay securely after placing your order using UPI, cards or netbanking through Razorpay.</p>
                          </div>
                        </div>
                      </button>
                    )}
                    <button type="button" onClick={() => setChosenPayment("cod")} aria-pressed={paymentMethod === "cod"} className={`w-full rounded-2xl border-2 p-5 text-left transition-colors ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Truck size={19} /></div>
                        <div>
                          <p className="font-semibold">Cash on Delivery</p>
                          <p className="mt-1 text-sm text-muted-foreground">Pay the courier when your order arrives.</p>
                        </div>
                      </div>
                    </button>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setStep("shipping")}
                        className="flex-1 py-4 rounded-xl border border-border font-semibold hover:bg-muted transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setCheckoutError("");
                          setStep("review");
                        }}
                        className="flex-1 bg-primary text-primary-foreground py-4 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                      >
                        Review Order
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "review" && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* Items Review (Desktop only; on Mobile, Order Summary is already shown right above) */}
                    <div className="hidden lg:block bg-card border border-border rounded-2xl p-6">
                      <h2 className="text-xl font-bold mb-4">Review Your Order</h2>
                      <div className="space-y-3">
                        {state.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3">
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                              <Image src={item.product.thumbnail} alt={item.product.name} fill sizes="80px" className="object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link href={`/products/${item.product.id}`} target="_blank" className="text-sm font-medium line-clamp-1 hover:text-primary hover:underline">{item.product.name}</Link>
                              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                            <p className="font-semibold text-sm">{formatPrice(item.price * item.quantity)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delivery, Shipping & Payment Review */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                      <h2 className="text-xl font-bold mb-4 lg:hidden">Review Your Order</h2>
                      <h3 className="font-semibold mb-2">Delivery Address</h3>
                      <p className="text-sm text-muted-foreground">
                        {address.fullName}, {address.street1}{address.street2 ? `, ${address.street2}` : ""}, {address.city}, {address.district}, {address.state} {address.zipCode}<br />{address.email} · {address.phone}
                      </p>
                      <h3 className="font-semibold mt-4 mb-2">Delivery Method</h3>
                      <p className="text-sm text-muted-foreground">
                        {shippingMethod === "overnight" ? "Priority Delivery (Next business day)" : shippingMethod === "express" ? "Express Delivery (2-3 business days)" : "Standard Delivery (5-7 business days)"} · {selectedShipping === 0 ? "FREE" : formatPrice(selectedShipping)}
                      </p>
                      <h3 className="font-semibold mt-4 mb-2">Payment</h3>
                      <p className="text-sm text-muted-foreground">
                        {paymentMethod === "upi" ? "Online payment (UPI / Razorpay)" : "Cash on Delivery"}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setStep("payment")}
                        className="px-6 py-4 rounded-xl border border-border font-semibold hover:bg-muted transition-colors shrink-0"
                      >
                        Back
                      </button>
                      <motion.button
                        onClick={handlePlaceOrder}
                        disabled={isPlacing}
                        className="flex-1 bg-primary text-primary-foreground px-4 py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-70"
                        whileTap={{ scale: 0.98 }}
                      >
                        {isPlacing ? "Placing Order..." : `Place Order · ${formatPrice(orderTotal)}`}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Order Summary Sidebar: 1st on Mobile (above Step Options), Right Column on Desktop */}
            <div className="order-1 lg:order-2 bg-card border border-border rounded-2xl p-5 sm:p-6 h-fit lg:sticky lg:top-24 space-y-4">
              <div>
                <h2 className="font-bold text-lg mb-4">Order Summary</h2>
                <div className="space-y-2 text-sm mb-4">
                  {state.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-muted-foreground line-clamp-1 flex-1 mr-2">
                        {item.product.name} ×{item.quantity}
                      </span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-border" />
              </div>

              {/* Coupon Code (also accessible on Instant Purchase / Buy Now) */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Tag size={14} className="text-primary" /> Coupon Code
                </p>
                {state.couponCode ? (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-green-800 dark:text-green-300">{state.couponCode} applied!</p>
                      <p className="text-[11px] text-green-700 dark:text-green-400">
                        {discount > 0 ? `You saved ${formatPrice(discount)}` : "Free standard shipping applied"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs text-muted-foreground hover:text-destructive font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        aria-label="Coupon code"
                        placeholder="Enter coupon code"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                        className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        className="px-3.5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                    {couponSuccess && <p className="text-xs text-green-700 dark:text-green-400">{couponSuccess}</p>}
                    {promotions.filter((p) => p.isPublic && isPromotionEligible(p, subtotal)).length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {promotions
                          .filter((p) => p.isPublic && isPromotionEligible(p, subtotal))
                          .map((promo) => (
                            <div
                              key={promo.id}
                              onClick={() => {
                                setCouponInput(promo.code);
                                handleApplyCoupon(promo.code);
                              }}
                              className="flex items-center justify-between p-2.5 border border-border rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
                            >
                              <div>
                                <p className="text-xs font-bold font-mono tracking-wide">{promo.code}</p>
                                <p className="text-[11px] text-muted-foreground">{getPromotionValueLabel(promo)}</p>
                              </div>
                              <button type="button" className="text-xs font-semibold text-primary">
                                Apply
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-px bg-border" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-700 dark:text-green-400">
                    <span>Discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                {giftWrap && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gift Wrap</span>
                    <span>₹499</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className={selectedShipping === 0 ? "text-green-700 dark:text-green-400" : ""}>{selectedShipping === 0 ? "FREE" : formatPrice(selectedShipping)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(orderTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
