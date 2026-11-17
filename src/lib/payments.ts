// Helpers for the owner-configured Razorpay / UPI payment destination.
// Only PUBLIC payment destinations and public Key IDs (rzp_test_... / rzp_live_...) are handled here.
// Never store a Razorpay Key Secret in the client or database.

const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
const RAZORPAY_KEY_ID_PATTERN = /^rzp_(test|live)_[a-zA-Z0-9]{8,32}$/;
const RAZORPAY_HOSTS = ["razorpay.me", "rzp.io", "pages.razorpay.com", "razorpay.com"];

export function isValidUpiId(value: string): boolean {
  return UPI_ID_PATTERN.test(value.trim());
}

export function isValidRazorpayKeyId(value: string): boolean {
  return RAZORPAY_KEY_ID_PATTERN.test(value.trim());
}

export function normalizePaymentUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed = RAZORPAY_HOSTS.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getActiveRazorpayKeyId(settings?: { razorpayKeyId?: string }): string | null {
  const candidate = (settings?.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
  return isValidRazorpayKeyId(candidate) ? candidate : null;
}

export function isOnlinePaymentConfigured(settings: {
  razorpayKeyId?: string;
  razorpayUpiId?: string;
  razorpayPaymentUrl?: string;
}): boolean {
  return Boolean(
    getActiveRazorpayKeyId(settings) ||
      (settings.razorpayPaymentUrl && normalizePaymentUrl(settings.razorpayPaymentUrl)) ||
      (settings.razorpayUpiId && isValidUpiId(settings.razorpayUpiId))
  );
}

export function buildUpiLink(upiId: string, payeeName: string, amount: number, note: string): string {
  const params = new URLSearchParams({ pa: upiId.trim(), pn: payeeName, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${params.toString()}`;
}

export interface RazorpayGatewayLaunchOptions {
  keyId: string;
  orderId: string;
  amountInr: number;
  storeName: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  onSuccess: (result: { paymentId: string; verified: boolean }) => void;
  onError?: (message: string) => void;
}

export async function launchRazorpayCheckout(options: RazorpayGatewayLaunchOptions): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Razorpay Checkout SDK"));
        document.body.appendChild(script);
      });
    }

    const orderRes = await fetch("/api/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: options.orderId,
        amount: options.amountInr,
        keyId: options.keyId,
      }),
    });
    const orderData = (await orderRes.json()) as {
      configured?: boolean;
      keyId?: string;
      razorpayOrderId?: string;
      amount?: number;
      currency?: string;
      error?: string;
    };
    if (!orderRes.ok || !orderData.keyId) {
      options.onError?.(orderData.error || "Razorpay gateway is not ready.");
      return;
    }

    const RazorpayCtor = (window as unknown as {
      Razorpay: new (opts: Record<string, unknown>) => { open: () => void };
    }).Razorpay;

    const rzp = new RazorpayCtor({
      key: orderData.keyId,
      amount: orderData.amount ?? Math.round(options.amountInr * 100),
      currency: orderData.currency || "INR",
      name: options.storeName || "Universal Cycles",
      description: `Order #${options.orderId}`,
      order_id: orderData.razorpayOrderId || undefined,
      prefill: {
        name: options.customerName || "",
        email: options.customerEmail || "",
        contact: options.customerPhone || "",
      },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id?: string;
        razorpay_signature?: string;
      }) => {
        try {
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: options.orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyJson = (await verifyRes.json()) as { verified?: boolean };
          options.onSuccess({
            paymentId: response.razorpay_payment_id,
            verified: Boolean(verifyJson.verified),
          });
        } catch {
          options.onSuccess({
            paymentId: response.razorpay_payment_id,
            verified: false,
          });
        }
      },
    });

    rzp.open();
  } catch (err) {
    options.onError?.((err as Error).message || "Could not launch Razorpay Checkout.");
  }
}
