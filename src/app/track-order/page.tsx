"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SafeImage as Image } from "@/components/ui/safe-image";
import { Search, Package, CreditCard, ExternalLink, CheckCircle2, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useOrders } from "@/contexts/orders-context";
import { useStoreSettings } from "@/contexts/store-settings-context";
import { ORDER_STATUSES } from "@/constants";
import { formatPrice, cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { buildUpiLink, getActiveRazorpayKeyId, isValidUpiId, launchRazorpayCheckout, normalizePaymentUrl } from "@/lib/payments";
import type { Order } from "@/types";

const PAYMENT_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "Payment Pending", color: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30" },
  paid: { label: "Payment Verified", color: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30" },
  refund_due: { label: "Refund Due", color: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30" },
  refunded: { label: "Refunded", color: "bg-slate-500/15 text-slate-800 dark:text-slate-300 border border-slate-500/30" },
  failed: { label: "Payment Failed", color: "bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/30" },
};

function TrackOrderContent() {
  const params = useSearchParams();
  const { orders, watchOrderById, updateOrder } = useOrders();
  const { settings } = useStoreSettings();
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === "admin@gmail.com";
  const [query, setQuery] = useState("");
  const [watchedOrder, setWatchedOrder] = useState<Order | null>(null);
  const [utrInput, setUtrInput] = useState("");
  const [utrSaved, setUtrSaved] = useState(false);
  const [verifyDigits, setVerifyDigits] = useState("");
  const [addressUnlocked, setAddressUnlocked] = useState(false);

  useEffect(() => {
    document.title = "Track Order | Universal Cycles";
  }, []);

  const orderId = (params.get("orderId") || query).trim();

  useEffect(() => {
    if (!orderId) {
      setWatchedOrder(null);
      return;
    }
    const unsub = watchOrderById(orderId, (found) => {
      setWatchedOrder(found);
      if (found?.paymentReference) {
        setUtrInput(found.paymentReference);
      }
    });
    return unsub;
  }, [orderId, watchOrderById]);

  const order =
    orders.find((item) => item.id.toLowerCase() === orderId.toLowerCase()) ??
    watchedOrder;

  const userOrders = user
    ? orders.filter((o) => o.userId === user.uid).sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const isOwnerOrAdmin = Boolean(
    order && (isAdmin || (user && order.userId && order.userId !== "guest" && order.userId === user.uid) || addressUnlocked)
  );

  const gatewayKeyId = getActiveRazorpayKeyId(settings);
  const razorpayHref = normalizePaymentUrl(settings.razorpayPaymentUrl);
  const upiHref =
    order && isValidUpiId(settings.razorpayUpiId)
      ? buildUpiLink(settings.razorpayUpiId, settings.storeName, order.total, `Order ${order.id}`)
      : "";

  const handleSaveUtr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !utrInput.trim()) return;
    updateOrder(order.id, {
      paymentReference: utrInput.trim(),
      updatedAt: Date.now(),
    });
    setUtrSaved(true);
  };

  const handleUnlockAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const cleanPhone = (order.shippingAddress.phone || "").replace(/\D/g, "");
    if (cleanPhone.length >= 4 && verifyDigits.trim() === cleanPhone.slice(-4)) {
      setAddressUnlocked(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto max-w-5xl flex-1 px-4 pt-28 pb-16 md:pt-36 md:px-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Track your order</h1>
          <p className="mt-3 text-muted-foreground text-lg">Enter your order number or log in to view your history.</p>
        </div>

        {!params.get("orderId") && (
          <form
            className="flex gap-2 mb-10"
            onSubmit={(event) => {
              event.preventDefault();
              window.history.replaceState(null, "", `/track-order?orderId=${encodeURIComponent(query.trim())}`);
            }}
          >
            <label className="sr-only" htmlFor="order-number">Order number</label>
            <input
              id="order-number"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. UC123456"
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
            <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
              <Search size={18} /> Track
            </button>
          </form>
        )}

        {/* Show Specific Order */}
        {order ? (
          <div className="space-y-6">
            <Link href="/track-order" className="text-sm font-semibold text-primary hover:underline block mb-4">
              &larr; Back to Order History
            </Link>
            <section className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1">Order Details</p>
                  <h2 className="text-2xl font-bold text-primary">#{order.id}</h2>
                  <p className="mt-1 text-sm font-medium">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold", PAYMENT_STATUS_BADGES[order.paymentStatus]?.color ?? PAYMENT_STATUS_BADGES.pending.color)}>
                    {PAYMENT_STATUS_BADGES[order.paymentStatus]?.label ?? `Payment: ${order.paymentStatus}`}
                  </span>
                  <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${ORDER_STATUSES[order.status]?.color}`}>
                    {ORDER_STATUSES[order.status]?.label ?? order.status}
                  </span>
                </div>
              </div>

              <div className="space-y-4 py-6">
                {order.items.map((item) => (
                  <div key={item.productId} className="flex gap-4 text-sm font-medium items-center">
                    <div className="w-16 h-16 bg-muted rounded-xl flex-shrink-0 relative overflow-hidden">
                      {item.thumbnail ? (
                        <Image src={item.thumbnail} alt={item.name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package size={20} /></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Link href={`/products/${item.productId}`} className="font-semibold text-base line-clamp-1 hover:text-primary hover:underline transition-colors">{item.name}</Link>
                      <p className="text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-bold text-lg">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t border-border pt-6 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment Method</span>
                  <span className="font-semibold uppercase text-foreground">{order.paymentMethod}</span>
                </div>
                {order.giftWrap && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Premium Gift Wrapping</span>
                    <span className="font-semibold text-foreground">{formatPrice(order.giftWrapFee ?? 499)}</span>
                  </div>
                )}
                {order.paymentReference && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>UTR / Payment Reference</span>
                    <span className="font-mono font-semibold text-foreground">{order.paymentReference}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 font-bold text-lg">
                  <span>Order Total</span>
                  <span className="text-primary">{formatPrice(order.total)}</span>
                </div>
              </div>

              {/* Complete or Verify UPI / Razorpay Payment from Track Order */}
              {order.paymentMethod === "upi" && order.paymentStatus === "pending" && order.status !== "cancelled" && (
                <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <CreditCard size={18} className="text-primary" /> Complete or Verify Your Payment
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pay <strong className="text-foreground">{formatPrice(order.total)}</strong> using Razorpay or your UPI app and quote Order <strong className="text-foreground">#{order.id}</strong>.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {gatewayKeyId && (
                      <button
                        type="button"
                        onClick={() =>
                          launchRazorpayCheckout({
                            keyId: gatewayKeyId,
                            orderId: order.id,
                            amountInr: order.total,
                            storeName: settings.storeName,
                            customerName: order.shippingAddress.fullName,
                            customerEmail: order.email,
                            customerPhone: order.shippingAddress.phone,
                            onSuccess: async ({ paymentId, verified }) => {
                              setUtrInput(paymentId);
                              await updateOrder(order.id, {
                                paymentReference: paymentId,
                                updatedAt: Date.now(),
                              });
                              if (verified) {
                                await updateOrder(order.id, {
                                  paymentStatus: "paid",
                                  updatedAt: Date.now(),
                                });
                              }
                              setUtrSaved(true);
                            },
                          })
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <CreditCard size={16} /> Pay with Razorpay
                      </button>
                    )}
                    {razorpayHref && (
                      <a
                        href={razorpayHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <CreditCard size={16} /> Pay with Razorpay <ExternalLink size={14} />
                      </a>
                    )}
                    {upiHref && (
                      <a
                        href={upiHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-background px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5"
                      >
                        Pay with UPI app ({settings.razorpayUpiId})
                      </a>
                    )}
                  </div>
                  <form onSubmit={handleSaveUtr} className="pt-2 border-t border-border/60">
                    <label htmlFor="track-utr-input" className="block text-xs font-semibold mb-1.5">
                      Already paid? Submit your 12-digit UTR / Razorpay Reference ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="track-utr-input"
                        type="text"
                        value={utrInput}
                        onChange={(e) => { setUtrInput(e.target.value); setUtrSaved(false); }}
                        placeholder="e.g. 412345678901 or pay_Nxyz123"
                        className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        {utrSaved || order.paymentReference ? "Update UTR" : "Submit UTR"}
                      </button>
                    </div>
                    {(utrSaved || order.paymentReference) && (
                      <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 size={14} /> Reference ({order.paymentReference || utrInput}) recorded for admin verification.
                      </p>
                    )}
                  </form>
                </div>
              )}

              {order.trackingNumber && (
                <div className="mt-8 rounded-2xl bg-primary/10 border border-primary/20 p-5">
                  <p className="text-sm font-bold text-primary">Carrier tracking reference</p>
                  <p className="mt-1 break-all font-mono text-lg font-semibold">{order.trackingNumber}</p>
                </div>
              )}

              <div className="mt-6 rounded-2xl bg-muted/50 p-5">
                <p className="text-sm font-bold mb-2">Delivery Destination</p>
                {order.shippingAddress.fullName && order.shippingAddress.fullName !== "Protected Customer" && (
                  <p className="text-sm font-medium">{order.shippingAddress.fullName}</p>
                )}
                {isOwnerOrAdmin && order.shippingAddress.street1 && order.shippingAddress.street1 !== "Protected Delivery Address" ? (
                  <p className="text-sm text-muted-foreground">
                    {order.shippingAddress.street1}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                    </p>
                    {order.shippingAddress.street1 && order.shippingAddress.street1 !== "Protected Delivery Address" && order.shippingAddress.phone ? (
                      <form onSubmit={handleUnlockAddress} className="flex flex-wrap items-center gap-2 pt-1">
                        <label htmlFor="verify-phone-digits" className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShieldCheck size={14} className="text-primary" /> Enter last 4 digits of phone to view full street address:
                        </label>
                        <input
                          id="verify-phone-digits"
                          type="text"
                          maxLength={4}
                          value={verifyDigits}
                          onChange={(e) => setVerifyDigits(e.target.value)}
                          placeholder="Last 4 digits"
                          className="w-28 rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                        />
                        <button type="submit" className="rounded-lg bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25">
                          Verify
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-primary" /> Full street address is protected on public tracking links. Sign in with your ordering account to view full address details.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : orderId ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-bold text-lg">We couldn’t find that order.</p>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">Please check the order number and try again. It usually starts with UC.</p>
            <button onClick={() => { setQuery(""); window.history.replaceState(null, "", "/track-order"); }} className="mt-6 inline-block font-bold text-primary hover:underline">Clear Search</button>
          </div>
        ) : user ? (
          <div className="mt-12 space-y-6">
            <h2 className="text-2xl font-bold mb-6">Your Order History</h2>
            {userOrders.length > 0 ? (
              userOrders.map((userOrder) => {
                const status = ORDER_STATUSES[userOrder.status as keyof typeof ORDER_STATUSES];
                return (
                  <Link href={`/track-order?orderId=${userOrder.id}`} key={userOrder.id} className="block group">
                    <article className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm hover:border-primary/50 transition-colors">
                      <div className="bg-muted/30 border-b border-border p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Order Placed</p>
                          <p className="text-sm font-bold">{new Date(userOrder.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Total</p>
                          <p className="text-sm font-bold text-primary">{formatPrice(userOrder.total)}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-1 sm:text-right border-t sm:border-t-0 border-border/60 pt-2 sm:pt-0">
                          <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Order #</p>
                          <p className="text-sm font-mono font-bold group-hover:text-primary transition-colors">{userOrder.id}</p>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn("w-2.5 h-2.5 rounded-full", status.color.includes("text-green") ? "bg-green-500" : status.color.includes("text-amber") ? "bg-amber-500" : "bg-blue-500")} />
                          <span className="font-bold text-base">{status.label}</span>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {userOrder.items.length} {userOrder.items.length === 1 ? 'item' : 'items'} • {userOrder.items.map(i => i.name).join(", ")}
                        </p>
                      </div>
                    </article>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
                <Package size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="font-bold text-lg">No orders yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">When you place an order, it will show up here.</p>
                <Link href="/category/adult-cycles" className="mt-6 inline-block font-bold text-primary hover:underline">Start Shopping</Link>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center mt-12">
            <p className="font-bold text-lg mb-2">Want to see your full history?</p>
            <p className="text-muted-foreground mb-6">Log in to view all your previous orders in one place.</p>
            <Link href="/login" className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors">
              Log In
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col">
          <Navbar />
          <main className="container mx-auto max-w-5xl flex-1 px-4 pt-28 pb-16 md:pt-36 md:px-8">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold tracking-tight">Track your order</h1>
              <p className="mt-3 text-muted-foreground text-lg">Enter your order number or log in to view your history.</p>
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
