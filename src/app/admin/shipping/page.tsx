"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Search, Truck } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { INDIA_STATES } from "@/data/indian-locations";
import { useShippingRates } from "@/contexts/shipping-rates-context";
import { useStoreSettings } from "@/contexts/store-settings-context";
import { useProducts } from "@/contexts/products-context";
import { DEFAULT_WEIGHT_KG, knownProductWeightKg, parseFreeShippingMinimum } from "@/lib/shipping";
import { formatPrice } from "@/lib/utils";

type SaveState = "saved" | "error";

export default function AdminShippingPage() {
  const { getRate, countForState, setRate, ready } = useShippingRates();
  const { settings, saveSettings } = useStoreSettings();
  const { products } = useProducts();

  useEffect(() => {
    document.title = "Shipping Rules | Universal Cycles Admin";
  }, []);
  const byWeight = settings.shippingByWeight;
  const withoutWeight = products.filter((product) => product.isActive && knownProductWeightKg(product) === undefined).length;
  const [search, setSearch] = useState("");
  const [expandedState, setExpandedState] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState("");
  const [freeInput, setFreeInput] = useState<string | null>(null);
  const [freeStatus, setFreeStatus] = useState<"saved" | "error" | null>(null);
  const [freeError, setFreeError] = useState("");

  const freeValue = freeInput ?? String(settings.freeShippingMinimum);
  const freeDirty = freeInput !== null && freeInput.replace(/[,₹\s]/g, "") !== String(settings.freeShippingMinimum);

  const saveFreeDelivery = () => {
    const parsed = parseFreeShippingMinimum(freeValue);
    if (!parsed.ok) {
      setFreeError(parsed.error);
      setFreeStatus("error");
      return;
    }
    saveSettings({ ...settings, freeShippingMinimum: parsed.value });
    setFreeInput(null);
    setFreeError("");
    setFreeStatus("saved");
    setTimeout(() => setFreeStatus(null), 2500);
  };

  const term = search.trim().toLowerCase();
  const states = useMemo(() => Object.keys(INDIA_STATES).filter((state) => {
    if (!term) return true;
    return state.toLowerCase().includes(term) || INDIA_STATES[state].some((district) => district.toLowerCase().includes(term));
  }), [term]);

  const saveRate = async (state: string, district: string, key: string, current: string) => {
    setError("");
    const raw = (inputs[key] ?? current).trim();
    const fee = raw === "" ? null : Number(raw);
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
      setError(`${district}: enter a delivery fee of 0 or more, or leave it empty to use the default.`);
      setStatus((prev) => ({ ...prev, [key]: "error" }));
      return;
    }
    try {
      await setRate(state, district, fee);
      setInputs((prev) => { const next = { ...prev }; delete next[key]; return next; });
      setStatus((prev) => ({ ...prev, [key]: "saved" }));
      setTimeout(() => setStatus((prev) => { const next = { ...prev }; delete next[key]; return next; }), 2000);
    } catch (saveError) {
      setStatus((prev) => ({ ...prev, [key]: "error" }));
      setError(`Could not save ${district}: ${(saveError as Error).message}. Make sure you are signed in as the admin.`);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-[1600px] w-full mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3"><Truck className="text-primary" /> Regional Delivery Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">Set the delivery fee for each state and district. Districts you leave empty use the default standard fee of {formatPrice(settings.standardShippingFee)}.</p>
        </div>

        <div className="bg-card border border-border/50 shadow-sm rounded-3xl p-5 sm:p-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Multiply delivery price by product weight</h2>
            <p className="text-sm text-muted-foreground">
              {byWeight
                ? "On: each district fee below is charged per kg. A 10 kg order to a district set to ₹40 costs 10 × ₹40 = ₹400."
                : "Off: each district fee below is a flat price per order, whatever the weight."}
            </p>
            {byWeight && (
              <p className="text-xs text-muted-foreground">
                Weight is each product&apos;s <strong>Weight (kg)</strong> × quantity. Districts with no fee still use the flat default of {formatPrice(settings.standardShippingFee)}.
                {withoutWeight > 0 && <span className="block mt-1 text-amber-700">{withoutWeight} active product{withoutWeight === 1 ? " has" : "s have"} no weight set and count as {DEFAULT_WEIGHT_KG} kg. Set it in Products → Edit.</span>}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={byWeight}
            aria-label="Multiply delivery price by product weight"
            onClick={() => saveSettings({ ...settings, shippingByWeight: !byWeight })}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${byWeight ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${byWeight ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="bg-card border border-border/50 shadow-sm rounded-3xl p-5 sm:p-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold">Free delivery over this amount</h2>
            <p className="text-sm text-muted-foreground">
              {settings.freeShippingMinimum === 0
                ? "Delivery is currently free on every order."
                : `Orders of ${formatPrice(settings.freeShippingMinimum)} or more ship free (Standard Delivery). Smaller orders pay the delivery fee below.`}
            </p>
          </div>
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <input
                aria-label="Free delivery minimum order amount"
                type="text"
                inputMode="numeric"
                value={freeValue}
                placeholder="e.g. 50000"
                onChange={(e) => { setFreeInput(e.target.value); setFreeStatus(null); setFreeError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") saveFreeDelivery(); }}
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-7 pr-3 text-sm font-semibold focus:outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={saveFreeDelivery}
              aria-label="Save free delivery amount"
              className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${freeStatus === "saved" ? "bg-green-100 text-green-700 border-green-200" : freeStatus === "error" ? "bg-destructive/10 text-destructive border-destructive/30" : freeDirty ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}
            >
              <Check size={18} />
            </button>
          </div>
          {freeError && <p role="alert" className="text-sm text-destructive">{freeError}</p>}
          {freeStatus === "saved" && <p role="status" className="text-sm text-green-700">Saved. The cart, product pages and checkout now use this amount.</p>}
          <p className="text-xs text-muted-foreground">The cart total before any coupon is compared with this amount. Enter 0 to make delivery free on every order.</p>
        </div>

        <div className="rounded-2xl bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
          <p>The fee you enter is the <strong>Standard Delivery</strong> fee{byWeight ? " per kg" : ""} for that district. Express and Priority delivery keep their usual surcharge on top of it.</p>
          <p>Orders that reach the free-delivery amount above, or use a free-shipping coupon, ship free.</p>
        </div>

        {error && <div role="alert" className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">{error}</div>}

        <div className="bg-card border border-border/50 shadow-sm rounded-3xl p-5 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h2 className="text-lg font-semibold">State &amp; District Rates (₹)</h2>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search state or district" type="text" placeholder="Search district or state..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-background border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          {!ready && <p className="text-sm text-muted-foreground">Loading saved rates...</p>}
          {states.length === 0 && <p className="text-sm text-muted-foreground">No state or district matches &quot;{search}&quot;.</p>}

          <div className="space-y-3">
            {states.map((state) => {
              const districts = term && !state.toLowerCase().includes(term)
                ? INDIA_STATES[state].filter((district) => district.toLowerCase().includes(term))
                : INDIA_STATES[state];
              const isExpanded = term ? true : expandedState === state;
              return (
                <div key={state} className="border border-border rounded-2xl overflow-hidden bg-background">
                  <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedState(isExpanded ? null : state)} className={`w-full flex justify-between items-center p-4 sm:p-5 text-left transition-colors ${isExpanded ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                    <span className="flex flex-col gap-1">
                      <span className="font-semibold">{state}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{countForState(state)} / {INDIA_STATES[state].length} districts configured</span>
                    </span>
                    <ChevronDown size={18} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border bg-muted/20 overflow-hidden">
                        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {districts.map((district) => {
                            const key = `${state}::${district}`;
                            const existing = getRate(state, district);
                            const current = existing !== undefined ? String(existing) : "";
                            const value = inputs[key] ?? current;
                            const dirty = value !== current;
                            const saveStatus = status[key];
                            return (
                              <div key={district} className="flex items-center justify-between gap-2 bg-card p-3 rounded-xl border border-border">
                                <span className="text-sm font-medium break-words w-1/2">{district}</span>
                                <div className="flex gap-2 w-1/2 shrink-0">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                                    <input
                                      aria-label={`Delivery fee${byWeight ? " per kg" : ""} for ${district}`}
                                      type="number" min="0" inputMode="numeric" value={value} placeholder={byWeight ? "per kg" : "default"}
                                      onChange={(e) => { setInputs((prev) => ({ ...prev, [key]: e.target.value })); setStatus((prev) => { const next = { ...prev }; delete next[key]; return next; }); }}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveRate(state, district, key, current); }}
                                      className="w-full bg-muted/40 border border-border rounded-lg py-1.5 pl-6 pr-2 text-xs font-bold focus:outline-none focus:border-primary"
                                    />
                                  </div>
                                  <button type="button" onClick={() => saveRate(state, district, key, current)} aria-label={`Save fee for ${district}`} className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${saveStatus === "saved" ? "bg-green-100 text-green-700 border-green-200" : saveStatus === "error" ? "bg-destructive/10 text-destructive border-destructive/30" : dirty ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}>
                                    <Check size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
