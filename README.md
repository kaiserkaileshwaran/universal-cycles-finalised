# Universal Cycles

An e-commerce store for bicycles and accessories, built with Next.js (App Router), Tailwind CSS and Firebase (Authentication + Realtime Database).

**Customers:** browse by category/brand, search, wishlist, cart, coupons, spin-to-win, checkout with state/district delivery rates, Cash on Delivery or online payment (Razorpay link / UPI), order tracking, optional push notifications.
**Store owner (admin):** products & stock, categories, brands, orders, customers, reviews, promotions, homepage images, Razorpay/UPI details, regional delivery rules (per district, optional per-kg pricing, free-delivery minimum), WhatsApp & push alerts for low stock.

## Run locally

```bash
npm install
cp .env.example .env.local      # then fill in the VAPID keys (see below)
npm run dev                      # http://localhost:3000
```

Quality checks: `npm run lint` · `npm run build` (production build).

## Environment variables

See [`.env.example`](.env.example). Summary:

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` (8 values) | Sign-in and the database |
| `NEXT_PUBLIC_SITE_URL` | Correct sitemap, robots.txt and share links (set to your live URL) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push notifications. Generate with `npx web-push generate-vapid-keys`. **Never commit the private key.** Without them the store works normally and push is simply disabled. |

## Firebase setup (one time)

1. **Realtime Database → Rules:** paste the contents of [`database.rules.json`](database.rules.json) and **Publish**. Re-publish whenever that file changes.
2. **Authentication → Sign-in method:** enable **Google** (with a support email) and **Email/Password**.
3. **Authentication → Settings → Authorized domains:** add `localhost` and your deployed domain (for Vercel, add `vercel.app` or your exact `*.vercel.app` host). Enter the host only: no `https://`, no slash.
4. **Authentication → Users:** create the admin user `admin@gmail.com` with a password you choose. That exact email is the admin (the database rules and the app both check it).

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project →** import the repo (framework: Next.js, auto-detected; build command `npm run build`).
3. Add every variable from `.env.example` under **Environment Variables**, with `NEXT_PUBLIC_SITE_URL` set to your Vercel URL.
4. Deploy, then add the live domain to Firebase **Authorized domains** (step 3 above).

## Payments, delivery and notifications

- **Razorpay / UPI:** Admin → *Settings & Profile* → *Razorpay Payments*. Only public details are stored (payment link, UPI ID), never a key secret. Online payments are confirmed manually: the owner marks the order as paid in *Orders*. Fully automatic confirmation would need a server webhook.
- **Delivery:** Admin → *Shipping Rules*. Set a fee per district, optionally multiply it by product weight (set *Weight (kg)* on products), and set the order amount above which delivery is free.
- **Push notifications:** need the VAPID variables above.

## Known limitations

- Orders, addresses and reviews are stored under paths that any visitor can read and write (see `database.rules.json`). That is fine for testing but **should be tightened before handling real customers' personal data**.
- Product pages in `sitemap.xml` list the built-in sample products, not products added later through the admin.
- No payment-gateway webhook, courier integration, pincode serviceability check or GST invoices yet.
