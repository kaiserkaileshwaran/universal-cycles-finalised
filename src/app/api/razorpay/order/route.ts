import { NextResponse } from "next/server";
import { isValidRazorpayKeyId } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    let body: { orderId?: unknown; amount?: unknown; keyId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const amountInr = Number(body.amount);
    const clientKeyId = typeof body.keyId === "string" ? body.keyId.trim() : "";

    if (!orderId || orderId.length > 64) {
      return NextResponse.json({ error: "Valid orderId is required" }, { status: 400 });
    }
    if (!Number.isFinite(amountInr) || amountInr <= 0 || amountInr > 10_000_000) {
      return NextResponse.json({ error: "Valid positive order amount is required" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || clientKeyId;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

    if (!keyId || !isValidRazorpayKeyId(keyId)) {
      return NextResponse.json(
        { configured: false, error: "Razorpay Key ID is not configured yet." },
        { status: 503 }
      );
    }

    const amountPaise = Math.round(amountInr * 100);

    // If only the public Key ID is configured (in Admin Settings or NEXT_PUBLIC_RAZORPAY_KEY_ID)
    // and RAZORPAY_KEY_SECRET has not been added to server environment variables yet,
    // return client_checkout mode so Razorpay Standard Checkout can still open with the Key ID.
    if (!keySecret) {
      return NextResponse.json({
        configured: true,
        mode: "client_checkout",
        keyId,
        amount: amountPaise,
        currency: "INR",
        receipt: orderId,
      });
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: orderId,
        notes: { storeOrderId: orderId },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Failed to create Razorpay order", details: errText.slice(0, 200) },
        { status: 502 }
      );
    }

    const rzpOrder = (await rzpRes.json()) as { id: string; amount: number; currency: string };
    return NextResponse.json({
      configured: true,
      mode: "orders_api",
      keyId,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: orderId,
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error creating Razorpay order" }, { status: 500 });
  }
}
