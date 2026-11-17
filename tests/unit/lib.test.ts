// Unit tests for the pure business-logic modules. Run with: npm test  (uses Node's built-in test runner, no extra dependencies)
import test from "node:test";
import assert from "node:assert/strict";

import {
  cartWeightKg,
  computeShippingFees,
  DEFAULT_WEIGHT_KG,
  knownProductWeightKg,
  parseFreeShippingMinimum,
  productWeightKg,
  rateKey,
} from "../../src/lib/shipping.ts";
import {
  buildUpiLink,
  getActiveRazorpayKeyId,
  isOnlinePaymentConfigured,
  isValidRazorpayKeyId,
  isValidUpiId,
  normalizePaymentUrl,
} from "../../src/lib/payments.ts";
import {
  INDIA_STATES,
  STATE_PIN_PREFIXES,
  isValidIndianPhone,
  isValidIndianPinForState,
  lookupStateByPin,
} from "../../src/data/indian-locations.ts";
import { COUPON_RULES, getCouponDiscount } from "../../src/constants/promotions.ts";
import { formatPrice, getDiscountPercent, slugify } from "../../src/lib/utils.ts";

type W = Parameters<typeof productWeightKg>[0];
const w = (o: object) => o as W;
const rates = { standardShippingFee: 99, expressShippingFee: 199, overnightShippingFee: 399 };

test("shipping: weight comes from weightKg, then a 'Weight' spec, then the default", () => {
  assert.equal(knownProductWeightKg(w({ weightKg: 14.2 })), 14.2);
  assert.equal(knownProductWeightKg(w({ specifications: { Weight: "14.2 kg" } })), 14.2);
  assert.equal(knownProductWeightKg(w({ specifications: { weight: "500 g" } })), 0.5);
  assert.equal(knownProductWeightKg(w({})), undefined);
  assert.equal(productWeightKg(w({})), DEFAULT_WEIGHT_KG);
  assert.equal(productWeightKg(w({ weightKg: 0 })), DEFAULT_WEIGHT_KG);
  assert.equal(productWeightKg(w({ weightKg: -3 })), DEFAULT_WEIGHT_KG);
  assert.equal(productWeightKg(w({ weightKg: Number.NaN })), DEFAULT_WEIGHT_KG);
  assert.equal(productWeightKg(w({ weightKg: Infinity })), DEFAULT_WEIGHT_KG);
});

test("shipping: cart weight multiplies by quantity", () => {
  assert.equal(cartWeightKg([{ product: w({ weightKg: 10 }), quantity: 2 }, { product: w({}), quantity: 3 }]), 23);
  assert.equal(cartWeightKg([]), 0);
});

test("shipping: flat default, free shipping, district rate, per-kg rate", () => {
  assert.deepEqual(computeShippingFees({ cartStandardFee: 99, storeRates: rates }), { standard: 99, express: 199, overnight: 399 });
  assert.equal(computeShippingFees({ cartStandardFee: 0, districtRate: 500, storeRates: rates }).standard, 0, "free-shipping carts stay free");
  assert.equal(computeShippingFees({ cartStandardFee: 99, districtRate: 150, storeRates: rates }).standard, 150);
  const byWeight = computeShippingFees({ cartStandardFee: 99, districtRate: 25, byWeight: true, cartWeightKg: 14, storeRates: rates });
  assert.equal(byWeight.standard, 350);
  assert.equal(byWeight.express, 199 + (350 - 99), "express keeps its surcharge over standard");
});

test("shipping: express/overnight never go negative when a district is cheaper than the default", () => {
  const cheap = computeShippingFees({ cartStandardFee: 99, districtRate: 0, storeRates: { standardShippingFee: 99, expressShippingFee: 50, overnightShippingFee: 60 } });
  assert.equal(cheap.express, 0);
  assert.equal(cheap.overnight, 0);
});

test("shipping: rateKey strips characters Firebase keys cannot hold", () => {
  assert.equal(rateKey("Dadra & Nagar.Haveli/#$[x]"), "Dadra & Nagar_Haveli____x_");
});

test("shipping: free-shipping minimum input validation", () => {
  assert.deepEqual(parseFreeShippingMinimum("1000"), { ok: true, value: 1000 });
  assert.deepEqual(parseFreeShippingMinimum("0"), { ok: true, value: 0 });
  for (const bad of ["", "-1", "abc", "1e99", "99999999999", "NaN", "Infinity"]) {
    assert.equal(parseFreeShippingMinimum(bad).ok, false, `"${bad}" must be rejected`);
  }
});

test("payments: UPI id validation", () => {
  for (const good of ["shop@ybl", "a.b-c_d@okaxis", "9876543210@paytm"]) assert.equal(isValidUpiId(good), true, good);
  for (const bad of ["", "shop", "@ybl", "shop@", "a b@ybl", "shop@@ybl", "shop@123", "x@y"]) assert.equal(isValidUpiId(bad), false, bad);
});

test("payments: only genuine Razorpay hosts are accepted as payment links (no host spoofing)", () => {
  assert.ok(normalizePaymentUrl("razorpay.me/@shop"));
  assert.ok(normalizePaymentUrl("https://rzp.io/l/abc"));
  assert.ok(normalizePaymentUrl("https://pages.razorpay.com/shop"));
  for (const evil of [
    "https://razorpay.com.evil.com/pay",
    "https://evilrazorpay.com/pay",
    "https://razorpay.com@evil.com/pay",
    "http://razorpay.me/x".replace("http", "javascript"),
    "javascript:alert(1)",
    "https://evil.com/?u=razorpay.me",
    "ftp://razorpay.me/x",
    "",
    "   ",
  ]) {
    assert.equal(normalizePaymentUrl(evil), null, evil);
  }
  assert.equal(normalizePaymentUrl("http://razorpay.me/x"), null, "plain http is rejected");
});

test("payments: online payment is 'configured' only with a valid Key ID, UPI id, or Razorpay link", () => {
  assert.equal(isOnlinePaymentConfigured({}), false);
  assert.equal(isOnlinePaymentConfigured({ razorpayUpiId: "bad" }), false);
  assert.equal(isOnlinePaymentConfigured({ razorpayPaymentUrl: "https://evil.com" }), false);
  assert.equal(isOnlinePaymentConfigured({ razorpayKeyId: "invalid_key" }), false);
  assert.equal(isOnlinePaymentConfigured({ razorpayKeyId: "rzp_test_AbCdEf123456" }), true);
  assert.equal(isOnlinePaymentConfigured({ razorpayKeyId: "rzp_live_9876543210XyZ" }), true);
  assert.equal(isOnlinePaymentConfigured({ razorpayUpiId: "shop@ybl" }), true);
  assert.equal(isOnlinePaymentConfigured({ razorpayPaymentUrl: "https://rzp.io/l/x" }), true);
});

test("payments: Razorpay Key ID validation and active key resolution", () => {
  assert.equal(isValidRazorpayKeyId("rzp_test_12345678ABCD"), true);
  assert.equal(isValidRazorpayKeyId("rzp_live_AbCdEfGh123456"), true);
  for (const bad of ["", "rzp_fake_12345678", "rzp_test_short", "pk_live_1234567890", "rzp_live_bad!char"]) {
    assert.equal(isValidRazorpayKeyId(bad), false, bad);
  }
  assert.equal(getActiveRazorpayKeyId({ razorpayKeyId: "rzp_live_ValidKey1234" }), "rzp_live_ValidKey1234");
  assert.equal(getActiveRazorpayKeyId({ razorpayKeyId: "not_valid" }), null);
});

test("payments: UPI deep link encodes amount (2 dp) and special characters", () => {
  const link = buildUpiLink("shop@ybl", "Universal Cycles & Co", 12345.5, "Order UC1");
  const params = new URL(link.replace("upi://", "https://x/")).searchParams;
  assert.equal(params.get("pa"), "shop@ybl");
  assert.equal(params.get("am"), "12345.50");
  assert.equal(params.get("pn"), "Universal Cycles & Co");
  assert.equal(params.get("cu"), "INR");
  assert.ok(link.startsWith("upi://pay?"));
});

test("locations: phone validation", () => {
  for (const good of ["9876543210", "+91 98765 43210", "919876543210", "09876543210", "6000000001", "98765-43210"]) {
    assert.equal(isValidIndianPhone(good), true, good);
  }
  for (const bad of ["", "12345", "5876543210", "0000000000", "9999999999", "98765432101", "abcdefghij", "1234567890"]) {
    assert.equal(isValidIndianPhone(bad), false, bad);
  }
});

test("locations: PIN code format and state-prefix validation", () => {
  assert.equal(isValidIndianPinForState("638001", "Tamil Nadu").valid, true);
  assert.equal(isValidIndianPinForState(" 560001 ", "Karnataka").valid, true);
  assert.equal(isValidIndianPinForState("110001", "Delhi (NCT)").valid, true);
  for (const bad of ["012345", "63800", "6380011", "63800a", "", "000000"]) assert.equal(isValidIndianPinForState(bad, "Tamil Nadu").valid, false, bad);
  assert.equal(isValidIndianPinForState("560001", "Tamil Nadu").valid, false, "Karnataka PIN is not valid for Tamil Nadu");
});

test("locations: every state has PIN prefixes and every prefixed state exists", () => {
  const states = Object.keys(INDIA_STATES);
  assert.deepEqual(states.filter((s) => !STATE_PIN_PREFIXES[s]), [], "states without PIN prefixes");
  assert.deepEqual(Object.keys(STATE_PIN_PREFIXES).filter((s) => !INDIA_STATES[s]), [], "prefix entries for unknown states");
});

test("locations: district lists are clean (no HTML entities, no duplicate/blank/odd-spaced names)", () => {
  const problems: string[] = [];
  for (const [state, districts] of Object.entries(INDIA_STATES)) {
    const seen = new Set<string>();
    for (const d of districts) {
      if (/&[a-z]+;/i.test(d)) problems.push(`${state}: HTML entity in "${d}"`);
      if (/\s{2,}/.test(d) || d !== d.trim() || !d) problems.push(`${state}: bad whitespace in "${d}"`);
      if (seen.has(d)) problems.push(`${state}: duplicate "${d}"`);
      seen.add(d);
    }
  }
  assert.deepEqual(problems, []);
});

test("locations: all 8 union territories + 28 states are selectable", () => {
  const names = Object.keys(INDIA_STATES).join("|");
  assert.match(names, /Ladakh/);
  assert.match(names, /Andaman/);
  assert.equal(Object.keys(INDIA_STATES).length, 36);
});

test("coupons: built-in rules", () => {
  assert.equal(getCouponDiscount("WELCOME10", 5000), 500);
  assert.equal(getCouponDiscount("WELCOME10", 4999), 0, "below minimum");
  assert.equal(getCouponDiscount("CYCLE20", 20000), 2000);
  assert.equal(getCouponDiscount("CYCLE20", 19999), 0);
  assert.equal(getCouponDiscount("FIVE5", 300), 300, "fixed discount never exceeds the subtotal");
  assert.equal(getCouponDiscount("FREESHIP", 99999), 0, "shipping coupons do not discount items");
  assert.equal(getCouponDiscount("WHEEL25", 1000), 250);
  assert.equal(getCouponDiscount("welcome10", 9999), 0, "built-in lookup is case-sensitive (live lookup is not)");
  assert.equal(getCouponDiscount(undefined, 9999), 0);
  for (const code of Object.keys(COUPON_RULES)) assert.ok(getCouponDiscount(code, 1_000_000) >= 0);
});

test("coupons: prototype keys are not treated as coupon codes", () => {
  for (const code of ["__proto__", "constructor", "toString", "hasOwnProperty"]) assert.equal(getCouponDiscount(code, 9999), 0, code);
});

test("coupons: percent discounts are whole rupees", () => {
  for (const subtotal of [5001, 5555, 12345, 99999]) {
    const d = getCouponDiscount("WELCOME10", subtotal);
    assert.equal(Number.isInteger(d), true, `${subtotal} -> ${d}`);
  }
});

test("locations: lookupStateByPin resolves Indian states and delivery ETAs accurately", () => {
  const tn = lookupStateByPin("638001");
  assert.equal(tn.valid, true);
  assert.equal(tn.state, "Tamil Nadu");
  assert.equal(tn.etaDays, "2–4 business days");

  const py = lookupStateByPin("605001");
  assert.equal(py.valid, true);
  assert.equal(py.state, "Puducherry (UT)");

  const mh = lookupStateByPin("400001");
  assert.equal(mh.valid, true);
  assert.equal(mh.state, "Maharashtra");
  assert.equal(mh.etaDays, "4–6 business days");

  const bad = lookupStateByPin("000123");
  assert.equal(bad.valid, false);
});

test("utils: formatting helpers", () => {
  assert.match(formatPrice(1234), /1,234/);
  assert.equal(getDiscountPercent(1000, 750), 25);
  assert.equal(slugify("Kids Cycles & Toys!"), "kids-cycles-toys");
});
