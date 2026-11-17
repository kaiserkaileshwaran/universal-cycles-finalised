import { NextResponse } from "next/server";
import crypto from "node:crypto";

function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  keySecret: string
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !keySecret) return false;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(razorpaySignature.trim(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    let body: {
      orderId?: unknown;
      razorpay_order_id?: unknown;
      razorpay_payment_id?: unknown;
      razorpay_signature?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
    const rzpOrderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
    const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature.trim() : "";

    if (!paymentId || !/^pay_[a-zA-Z0-9]{8,32}$/.test(paymentId)) {
      return NextResponse.json({ error: "Valid razorpay_payment_id is required" }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    if (keySecret && rzpOrderId) {
      const valid = verifyRazorpayPaymentSignature(rzpOrderId, paymentId, signature, keySecret);
      if (!valid) {
        return NextResponse.json({ verified: false, error: "Invalid Razorpay payment signature" }, { status: 400 });
      }
      return NextResponse.json({
        verified: true,
        paymentStatus: "paid",
        paymentReference: paymentId,
      });
    }

    // When only the public Key ID is configured without RAZORPAY_KEY_SECRET on the server yet,
    // record the payment ID for admin verification.
    return NextResponse.json({
      verified: false,
      paymentStatus: "pending",
      paymentReference: paymentId,
      message: "Payment reference recorded. Add RAZORPAY_KEY_SECRET on the server for automatic signature verification.",
    });
  } catch {
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
  }
}
