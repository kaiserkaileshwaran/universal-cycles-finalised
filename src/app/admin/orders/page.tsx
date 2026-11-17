"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle, XCircle, MessageSquare, Gift, AlertTriangle, RotateCcw } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatPrice, cn } from "@/lib/utils";
import { ORDER_STATUSES } from "@/constants";
import { useOrders } from "@/contexts/orders-context";
import { useProducts } from "@/contexts/products-context";
import { sendPushNotification } from "@/lib/push-helper";
import type { Order } from "@/types";

function getWhatsAppUpdateLink(order: Order): string {
  const phone = (order.shippingAddress?.phone || "").replace(/\D/g, "");
  const formattedPhone = phone.startsWith("91") ? phone : phone.length === 10 ? `91${phone}` : phone;
  const name = order.shippingAddress?.fullName || "Customer";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://universalcycles.com";
  const itemsText = order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ");
  const paymentNote =
    order.paymentStatus === "paid"
      ? "Payment: Paid"
      : order.paymentMethod === "cod"
      ? `Payment: Cash on Delivery (₹${order.total.toLocaleString("en-IN")})`
      : `Order Total: ₹${order.total.toLocaleString("en-IN")}`;

  let statusMsg = "";
  if (order.status === "processing") {
    statusMsg = `Your order (${itemsText}) is now being packed and prepared for dispatch. Track live: ${siteUrl}/track-order?orderId=${order.id}`;
  } else if (order.status === "shipped") {
    const tracking = order.trackingNumber ? ` Carrier tracking reference: ${order.trackingNumber}.` : "";
    statusMsg = `Your cycle (${itemsText}) is on the way!${tracking} Track live: ${siteUrl}/track-order?orderId=${order.id}`;
  } else if (order.status === "delivered") {
    statusMsg = `Your order (${itemsText}) has been delivered! We hope you love your new cycle. 🚴`;
  } else if (order.status === "cancelled") {
    statusMsg = `Your order #${order.id} (${itemsText}) has been cancelled as requested.`;
  } else {
    statusMsg = `We have confirmed your order (${itemsText}) for ₹${order.total.toLocaleString("en-IN")}. Track live: ${siteUrl}/track-order?orderId=${order.id}`;
  }

  const message = `Hello ${name}! 👋\nUpdate on your Universal Cycles Order #${order.id} (${order.status.toUpperCase()}):\n${statusMsg}\n${paymentNote}\n\nThank you for choosing Universal Cycles!`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

const STATUS_FLOW = ["pending", "processing", "shipped", "delivered"];

export default function AdminOrdersPage() {
  const { orders, updateOrder } = useOrders();
  const { restoreStockForOrder } = useProducts();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [lastUpdatedOrder, setLastUpdatedOrder] = useState<Order | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [utrInput, setUtrInput] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  useEffect(() => {
    document.title = "Manage Orders | Universal Cycles Admin";
  }, []);

  const newOrdersCount = useMemo(() => orders.filter((o) => o.status === "pending").length, [orders]);

  const visibleOrders = useMemo(() => {
    const mapped = orders.map((order) => ({
      ...order,
      customer: order.shippingAddress.fullName,
      email: order.email ?? "",
      itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
      date: new Date(order.createdAt).toLocaleDateString(),
      payment: order.paymentMethod,
    }));
    // Prioritize new (pending) orders at the top so the admin immediately sees new arrivals
    return mapped.sort((a, b) => {
      const aPending = a.status === "pending" ? 1 : 0;
      const bPending = b.status === "pending" ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return b.createdAt - a.createdAt;
    });
  }, [orders]);

  const filtered = visibleOrders.filter((o) => {
    const q = search.toLowerCase();
    const matchQ =
      o.id.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      (o.paymentReference ?? "").toLowerCase().includes(q);
    return matchQ && (filterStatus === "all" || o.status === filterStatus);
  });

  const updateOrderStatus = (id: string, newStatus: string) => {
    const order = orders.find((item) => item.id === id);
    if (!order) return;

    const patch: Partial<Order> = {
      status: newStatus as Order["status"],
      updatedAt: Date.now(),
    };

    if (newStatus === "cancelled" && order.status !== "cancelled") {
      if (order.paymentStatus === "paid" || order.paymentStatus === "refund_due") {
        patch.paymentStatus = "refund_due";
      }
      if (order.stockDeducted && !order.stockRestored) {
        patch.stockRestored = true;
        void restoreStockForOrder(
          order.items.map((line) => ({ productId: line.productId, quantity: line.quantity }))
        );
      }
    }

    updateOrder(id, patch);
    const updatedSnapshot = { ...order, ...patch };
    setViewOrder((current) => (current && current.id === id ? updatedSnapshot : current));
    setLastUpdatedOrder(updatedSnapshot);

    const statusLabels: Record<string, string> = {
      processing: "is being packed & prepared for dispatch",
      shipped: "has been dispatched and is on the way! 🚚",
      delivered: "has been delivered! Happy riding! 🚴",
      cancelled: "has been cancelled",
    };
    const desc = statusLabels[newStatus] || `status is now ${newStatus}`;
    sendPushNotification(
      `Order #${id} ${newStatus.toUpperCase()}`,
      `Your Universal Cycles order ${desc}. Tap to track live!`,
      `/track-order?orderId=${id}`
    );
  };

  const initiateCancelOrder = (order: Order) => {
    setConfirmingCancel(true);
    if (order.paymentStatus === "paid") {
      const patch: Partial<Order> = {
        paymentStatus: "refund_due",
        updatedAt: Date.now(),
      };
      updateOrder(order.id, patch);
      setViewOrder((current) => (current && current.id === order.id ? { ...current, ...patch } : current));
    }
  };

  const confirmCancelOrder = (id: string) => {
    updateOrderStatus(id, "cancelled");
    setConfirmingCancel(false);
    setViewOrder(null);
  };

  const abortCancelOrder = (order: Order) => {
    setConfirmingCancel(false);
    if (order.paymentStatus === "refund_due" && order.status !== "cancelled") {
      const patch: Partial<Order> = {
        paymentStatus: "paid",
        updatedAt: Date.now(),
      };
      updateOrder(order.id, patch);
      setViewOrder((current) => (current && current.id === order.id ? { ...current, ...patch } : current));
    }
  };

  const openOrder = (order: Order) => {
    setViewOrder(order);
    setTrackingInput(order.trackingNumber ?? "");
    setUtrInput(order.paymentReference ?? "");
    setConfirmingCancel(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              Orders
              {newOrdersCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  {newOrdersCount} New {newOrdersCount === 1 ? "Order" : "Orders"}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">{orders.length} total orders</p>
          </div>
          {newOrdersCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === "pending" ? "all" : "pending")}
              className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-4 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 transition-colors"
            >
              {filterStatus === "pending" ? "Show All Orders" : `Filter ${newOrdersCount} New Order${newOrdersCount === 1 ? "" : "s"}`}
            </button>
          )}
        </div>

        {/* Status Summary */}
        <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar snap-x">
          {["all", ...Object.keys(ORDER_STATUSES)].map((status) => {
            const count = status === "all" ? orders.length : orders.filter((o) => o.status === status).length;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all shrink-0 min-w-[110px] snap-start",
                  filterStatus === status ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                )}
              >
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground capitalize">{status}</p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="Search orders"
              placeholder="Search by order ID, customer, UTR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* 1-Click WhatsApp Status Update Banner when Admin updates an order status */}
        {lastUpdatedOrder && lastUpdatedOrder.shippingAddress?.phone && (
          <div
            data-testid="whatsapp-status-prompt"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#075E54]/40 bg-[#075E54]/10 px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle size={18} className="text-[#075E54] dark:text-emerald-400 shrink-0" />
              <span>
                Order <strong>#{lastUpdatedOrder.id}</strong> marked as{" "}
                <strong className="uppercase">{lastUpdatedOrder.status}</strong>. Notify{" "}
                <strong>{lastUpdatedOrder.shippingAddress.fullName}</strong> on WhatsApp?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={getWhatsAppUpdateLink(lastUpdatedOrder)}
                target="_blank"
                rel="noreferrer"
                data-testid="whatsapp-prompt-link"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#075E54] hover:bg-[#054640] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors"
              >
                <MessageSquare size={14} /> Send WhatsApp Update
              </a>
              <button
                type="button"
                onClick={() => setLastUpdatedOrder(null)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Responsive Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-4 py-3 whitespace-nowrap">Order ID</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-4 py-3 whitespace-nowrap">Customer</th>
                  <th className="hidden md:table-cell text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Items</th>
                  <th className="hidden sm:table-cell text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Total</th>
                  <th className="hidden lg:table-cell text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Payment</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="hidden lg:table-cell text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((order) => {
                  const statusInfo = ORDER_STATUSES[order.status as keyof typeof ORDER_STATUSES];
                  const isNewOrder = order.status === "pending";
                  return (
                    <tr
                      key={order.id}
                      data-new-order={isNewOrder ? "true" : "false"}
                      className={cn(
                        "transition-colors",
                        isNewOrder
                          ? "bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-500"
                          : "hover:bg-muted/20"
                      )}
                    >
                      <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-mono font-medium align-top sm:align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button onClick={() => openOrder(order)} className="text-primary hover:underline font-bold text-left">
                            #{order.id}
                          </button>
                          {isNewOrder && (
                            <span
                              data-testid={`new-order-badge-${order.id}`}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-slate-950 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider font-sans shadow-xs"
                            >
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="sm:hidden text-xs font-bold text-foreground mt-1">{formatPrice(order.total)}</p>
                      </td>
                      <td className="px-3 sm:px-4 py-3 align-top sm:align-middle">
                        <p className="text-xs sm:text-sm font-medium line-clamp-1">{order.customer}</p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground truncate max-w-[130px] sm:max-w-[200px]">{order.email}</p>
                        <p className="lg:hidden text-[11px] uppercase text-muted-foreground font-medium mt-0.5">
                          {order.payment} · {order.paymentStatus}
                        </p>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-sm">
                        <div className="flex flex-col gap-1 max-w-[250px]">
                          {order.items.map((item) => (
                            <Link key={item.productId} href={`/products/${item.productId}`} className="text-primary font-medium hover:underline truncate" title={item.name}>
                              {item.quantity}x {item.name}
                            </Link>
                          ))}
                          {order.giftWrap && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <Gift size={12} /> Gift Wrap (+₹499)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-sm font-semibold whitespace-nowrap">{formatPrice(order.total)}</td>
                      <td className="hidden lg:table-cell px-4 py-3 text-xs uppercase text-muted-foreground font-medium whitespace-nowrap">
                        <span>{order.payment} · {order.paymentStatus}</span>
                        {order.paymentReference && (
                          <span className="block font-mono text-[11px] text-foreground truncate max-w-[140px]" title={order.paymentReference}>
                            Ref: {order.paymentReference}
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 align-top sm:align-middle">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <select
                            aria-label={`Status for order ${order.id}`}
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            className={cn("text-xs font-semibold px-2 py-1 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary", statusInfo?.color)}
                          >
                            {Object.entries(ORDER_STATUSES).map(([key, info]) => (
                              <option key={key} value={key} className="text-foreground bg-background">{info.label}</option>
                            ))}
                          </select>
                          {order.shippingAddress?.phone && (
                            <a
                              href={getWhatsAppUpdateLink(order)}
                              target="_blank"
                              rel="noreferrer"
                              data-testid={`whatsapp-btn-${order.id}`}
                              aria-label={`Send WhatsApp update to ${order.shippingAddress.fullName}`}
                              title={`Send WhatsApp update to ${order.shippingAddress.phone}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#075E54] text-white hover:bg-[#054640] text-xs font-bold transition-colors shrink-0"
                            >
                              <MessageSquare size={13} />
                              <span className="hidden xl:inline">WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{order.date}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground">No orders found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Detail Modal */}
        <AnimatePresence>
          {viewOrder && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50"
                onClick={() => setViewOrder(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="order-modal-title"
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-xl max-h-[90vh] overflow-y-auto bg-background border border-border rounded-2xl z-50 shadow-2xl"
              >
                <div className="p-6 border-b">
                  <h2 id="order-modal-title" className="font-bold text-lg">Order #{viewOrder.id}</h2>
                  <p className="text-sm text-muted-foreground">{new Date(viewOrder.createdAt).toLocaleString()}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <p className="font-medium">{viewOrder.shippingAddress.fullName}</p>
                      <p className="text-xs text-muted-foreground">{viewOrder.shippingAddress.phone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium break-all">{viewOrder.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-bold text-primary">{formatPrice(viewOrder.total)}</p>
                      {viewOrder.giftWrap && (
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1 mt-0.5">
                          <Gift size={12} /> Gift Wrap included (+₹499)
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment</p>
                      <p className="font-medium uppercase">{viewOrder.paymentMethod} · {viewOrder.paymentStatus}</p>
                      {viewOrder.paymentReference && (
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">Ref: {viewOrder.paymentReference}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="order-utr" className="text-muted-foreground block text-xs font-semibold">
                        Payment Reference / UTR ID
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input
                          id="order-utr"
                          value={utrInput}
                          onChange={(event) => setUtrInput(event.target.value)}
                          placeholder="12-digit UTR or Razorpay Payment ID"
                          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const refVal = utrInput.trim() || undefined;
                            updateOrder(viewOrder.id, { paymentReference: refVal, updatedAt: Date.now() });
                            setViewOrder((current) => (current ? { ...current, paymentReference: refVal } : current));
                          }}
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          Save Ref
                        </button>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="order-tracking" className="text-muted-foreground block text-xs font-semibold">
                        Tracking number
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input
                          id="order-tracking"
                          value={trackingInput}
                          onChange={(event) => setTrackingInput(event.target.value)}
                          placeholder="Carrier tracking reference"
                          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateOrder(viewOrder.id, { trackingNumber: trackingInput.trim() || undefined, updatedAt: Date.now() });
                            setViewOrder((current) => (current ? { ...current, trackingNumber: trackingInput.trim() || undefined } : current));
                          }}
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="border-y border-border py-4 my-4">
                    <p className="text-sm font-semibold mb-3">Items to Pack</p>
                    <div className="space-y-3">
                      {viewOrder.items.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between gap-4 text-sm bg-muted/30 p-3 rounded-lg border border-border">
                          <div className="flex-1">
                            <Link href={`/products/${item.productId}`} className="font-semibold text-primary hover:underline">{item.name}</Link>
                            <p className="text-muted-foreground text-xs mt-0.5">Product ID: {item.productId}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">x{item.quantity}</p>
                            <p className="text-xs text-muted-foreground">{formatPrice(item.price)} each</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Progress */}
                  <div>
                    <p className="text-sm font-semibold mb-3">Order Status</p>
                    <div className="flex items-center gap-2">
                      {STATUS_FLOW.map((s, i) => {
                        const currentIdx = STATUS_FLOW.indexOf(viewOrder.status);
                        const done = currentIdx >= i;
                        return (
                          <div key={s} className="flex items-center">
                            <div className={cn("flex flex-col items-center gap-1", done ? "text-primary" : "text-muted-foreground")}>
                              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold", done ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                {done ? <CheckCircle size={14} /> : i + 1}
                              </div>
                              <span className="text-xs capitalize whitespace-nowrap">{s}</span>
                            </div>
                            {i < STATUS_FLOW.length - 1 && (
                              <div className={cn("flex-1 h-0.5 mx-1 min-w-4", done && currentIdx > i ? "bg-primary" : "bg-muted")} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {confirmingCancel && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-3">
                      <div className="flex items-start gap-2 text-destructive text-xs font-semibold">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>
                          Are you sure you want to cancel Order #{viewOrder.id}?{" "}
                          {viewOrder.paymentStatus === "paid" || viewOrder.paymentStatus === "refund_due"
                            ? "This order was already paid and has been flagged as Refund Due."
                            : "Reserved stock will be restored."}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmCancelOrder(viewOrder.id)}
                          className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white hover:bg-destructive/90"
                        >
                          Confirm Cancel Order
                        </button>
                        <button
                          type="button"
                          onClick={() => abortCancelOrder(viewOrder)}
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
                        >
                          Keep Order
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t flex flex-col gap-3">
                  {viewOrder.shippingAddress?.phone && (
                    <a
                      href={getWhatsAppUpdateLink(viewOrder)}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="modal-whatsapp-btn"
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#075E54] text-white font-bold hover:bg-[#054640] transition-all shadow-md text-sm"
                    >
                      <MessageSquare size={16} /> Send WhatsApp Status Update to Customer
                    </a>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {["pending", "processing"].includes(viewOrder.status) && !confirmingCancel && (
                      <button
                        type="button"
                        onClick={() => initiateCancelOrder(viewOrder)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-destructive text-destructive font-semibold hover:bg-destructive/10 text-sm"
                      >
                        <XCircle size={16} /> Cancel Order
                      </button>
                    )}

                    {viewOrder.paymentStatus === "refund_due" && (
                      <button
                        type="button"
                        onClick={() => {
                          updateOrder(viewOrder.id, { paymentStatus: "refunded", updatedAt: Date.now() });
                          setViewOrder((current) => (current ? { ...current, paymentStatus: "refunded" } : current));
                        }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-800"
                      >
                        <RotateCcw size={15} /> Mark Refunded
                      </button>
                    )}

                    {viewOrder.paymentStatus !== "paid" &&
                      viewOrder.paymentStatus !== "refund_due" &&
                      viewOrder.paymentStatus !== "refunded" &&
                      (viewOrder.paymentMethod === "upi" || (viewOrder.paymentMethod === "cod" && viewOrder.status === "delivered")) && (
                        <button
                          type="button"
                          onClick={() => {
                            const verifiedRef =
                              utrInput.trim() ||
                              viewOrder.paymentReference ||
                              `RZP-VERIFIED-${Date.now().toString(36).toUpperCase()}`;
                            setUtrInput(verifiedRef);
                            updateOrder(viewOrder.id, {
                              paymentStatus: "paid",
                              paymentReference: verifiedRef,
                              updatedAt: Date.now(),
                            });
                            setViewOrder((current) =>
                              current
                                ? { ...current, paymentStatus: "paid", paymentReference: verifiedRef }
                                : current
                            );
                          }}
                          className="flex-1 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800"
                        >
                          {viewOrder.paymentMethod === "upi" ? "Mark payment received" : "Mark collected"}
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => setViewOrder(null)}
                      className="flex-1 py-3 px-4 rounded-xl border border-border font-semibold hover:bg-muted text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
