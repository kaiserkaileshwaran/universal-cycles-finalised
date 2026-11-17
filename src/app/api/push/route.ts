import { NextResponse } from "next/server";
import webpush from "web-push";

const MAX_SUBSCRIPTIONS_PER_REQUEST = 1000;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 500;
const MAX_URL_LENGTH = 300;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateBuckets = new Map<string, number[]>();

const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
];

function isRateLimited(req: Request): boolean {
  const hasTrustedProxy = Boolean(req.headers.get("x-vercel-id") || req.headers.get("cf-ray"));
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = hasTrustedProxy
    ? (forwarded ? forwarded.split(",")[0] : "local")?.trim() || "local"
    : forwarded
    ? "untrusted-xff"
    : "local";
  const now = Date.now();
  const prev = rateBuckets.get(ip) || [];
  const active = prev.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (active.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateBuckets.set(ip, active);
    return true;
  }
  active.push(now);
  rateBuckets.set(ip, active);
  return false;
}

const DEFAULT_VAPID_PUBLIC_KEY =
  "BDOx7Yeq__h_qpVEJQvq0rUne6TCOPjg8OgZbPpU2MEf_qY1KIHhd16chrhsIDntW3yqM7onTXl-A-aALnxMezQ";
const DEFAULT_VAPID_PRIVATE_KEY =
  "9DQsfI6B0trCGgTiadRC-bJURxEROideZCx_tfH2Mis";

let vapidConfigured = false;
/** Reads the VAPID keys from the environment (or built-in fallback keys). */
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@universalcycles.in", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  if (!/^\/(?!\/|\\)/.test(value)) return false;
  try {
    const parsed = new URL(value, "https://universalcycles.in");
    return parsed.origin === "https://universalcycles.in" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

function isValidSubscription(value: unknown): value is PushSubscriber {
  if (!value || typeof value !== "object") return false;
  const sub = value as { endpoint?: unknown; disabled?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (sub.disabled === true) return false;
  if (typeof sub.endpoint !== "string" || sub.endpoint.length > 1000) return false;
  try {
    const parsed = new URL(sub.endpoint);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const hostAllowed = ALLOWED_PUSH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    if (!hostAllowed) return false;
  } catch {
    return false;
  }
  return typeof sub.keys?.p256dh === "string" && typeof sub.keys?.auth === "string";
}

async function verifyAdminBearerToken(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      email?: string;
      email_verified?: boolean;
      admin?: boolean;
      exp?: number;
    };
    if (!claims.exp || claims.exp * 1000 < Date.now()) return false;
    const isAdminClaim =
      claims.admin === true ||
      (claims.email?.toLowerCase() === "admin@gmail.com" && claims.email_verified !== false);
    if (!isAdminClaim) return false;

    const useEmulator =
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1" ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-universal-cycles" ||
      (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "").includes("127.0.0.1:9000");
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "fake";
    const lookupUrl = useEmulator
      ? "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake"
      : `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(lookupUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: Array<{ email?: string }> };
    const verifiedEmail = data.users?.[0]?.email?.toLowerCase();
    return verifiedEmail === "admin@gmail.com" || claims.admin === true;
  } catch {
    return false;
  }
}

interface TargetInfo {
  productName?: string;
  category?: string;
  brand?: string;
  tags?: string[];
}

interface PushSubscriber extends webpush.PushSubscription {
  interests?: string[];
}

export async function POST(req: Request) {
  try {
    if (isRateLimited(req)) {
      return NextResponse.json({ error: "Too many push requests. Please slow down." }, { status: 429 });
    }

    if (!ensureVapid()) {
      return NextResponse.json({ error: "Push notifications are not configured on this server." }, { status: 503 });
    }

    let payload: { title?: unknown; body?: unknown; url?: unknown; subscriptions?: unknown; targetInfo?: TargetInfo };
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: `title is required (max ${MAX_TITLE_LENGTH} characters)` }, { status: 400 });
    }

    const { title, body, url, targetInfo } = payload;

    if (typeof title !== "string" || !title.trim() || title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: `title is required (max ${MAX_TITLE_LENGTH} characters)` }, { status: 400 });
    }
    if (typeof body !== "string" || !body.trim() || body.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: `body is required (max ${MAX_BODY_LENGTH} characters)` }, { status: 400 });
    }
    if (url !== undefined && !isSafeRelativePath(url)) {
      return NextResponse.json({ error: "url must be a safe site path starting with a single /" }, { status: 400 });
    }
    if (!Array.isArray(payload.subscriptions) || payload.subscriptions.length === 0) {
      return NextResponse.json({ error: "No subscriptions provided" }, { status: 400 });
    }
    if (payload.subscriptions.length > MAX_SUBSCRIPTIONS_PER_REQUEST) {
      return NextResponse.json({ error: `Too many subscriptions (max ${MAX_SUBSCRIPTIONS_PER_REQUEST})` }, { status: 400 });
    }
    const hasInvalidProtocol = payload.subscriptions.some((sub) => {
      if (!sub || typeof sub !== "object") return true;
      const endpoint = (sub as { endpoint?: unknown }).endpoint;
      return typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000;
    });
    if (hasInvalidProtocol) {
      return NextResponse.json({ error: "All subscription endpoints must use https://" }, { status: 400 });
    }

    const isAuthorized = await verifyAdminBearerToken(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: admin authentication required" }, { status: 401 });
    }

    const subscriptions = payload.subscriptions.filter(isValidSubscription);
    if (subscriptions.length === 0) {
      return NextResponse.json({ error: "No valid subscriptions provided" }, { status: 400 });
    }

    const safeUrl = typeof url === "string" ? url : "/";

    const sendPromises = subscriptions.map((sub) => {
      let finalTitle = title.startsWith("Universal Cycles") ? title : `Universal Cycles: ${title}`;
      let finalBody = body;

      if (targetInfo && sub.interests && Array.isArray(sub.interests)) {
        const userInterests: string[] = sub.interests;
        const matched = userInterests.find((interest: string) => {
          const term = (interest || "").toLowerCase().trim();
          if (!term) return false;
          return (
            targetInfo.productName?.toLowerCase().includes(term) ||
            targetInfo.category?.toLowerCase().includes(term) ||
            targetInfo.brand?.toLowerCase().includes(term) ||
            targetInfo.tags?.some((t: string) => t.toLowerCase().includes(term))
          );
        });

        if (matched) {
          const prodName = targetInfo.productName || "New cycle";
          finalTitle = `Universal Cycles: 🔥 Matches your search for "${matched}"!`;
          finalBody = `Discover the all-new ${prodName}, freshly launched in stock. Tap to explore!`;
        }
      }

      const notificationPayload = JSON.stringify({
        title: finalTitle,
        body: finalBody,
        url: safeUrl,
        icon: "/cycle.png",
      });

      return webpush.sendNotification(sub, notificationPayload).catch((e) => {
        console.error("Error sending to subscription", sub.endpoint, e);
        return null;
      });
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, message: `Sent push to ${subscriptions.length} subscribers.` });
  } catch (error) {
    console.error("Push Error:", error);
    return NextResponse.json({ error: "Failed to send push notification" }, { status: 500 });
  }
}
