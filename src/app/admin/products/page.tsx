"use client";

import { useEffect, useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Edit2, Trash2, X, Check, ChevronUp, ChevronDown, MessageSquare
} from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useCategories } from "@/contexts/categories-context";
import { useBrands } from "@/contexts/brands-context";
import { useStoreSettings } from "@/contexts/store-settings-context";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useProducts } from "@/contexts/products-context";
import { sendPushNotification, sendStockRestockNotification, getOwnerStockAlertWhatsAppLink } from "@/lib/push-helper";

type SortField = "name" | "price" | "stock" | "rating";
type SortDir = "asc" | "desc";

type SortIconProps = {
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
};

function SortIcon({ field, currentField, currentDir }: SortIconProps) {
  if (currentField !== field) {
    return <ChevronDown size={14} className="opacity-20" />;
  }

  return currentDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
}

export default function AdminProductsPage() {
  const { products, setProducts } = useProducts();
  const { categories: CATEGORIES } = useCategories();
  const { brands: dynamicBrands } = useBrands();
  const { settings } = useStoreSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    price: "",
    salePrice: "",
    stock: "",
    weightKg: "",
    warrantyInfo: "",
    categoryId: "",
    subcategoryId: "",
    description: "",
    isActive: true,
    images: [] as string[],
    features: [] as string[],
    specifications: [] as { key: string; value: string }[],
  });

  const [newImageUrl, setNewImageUrl] = useState("");
  const [newFeature, setNewFeature] = useState("");
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecVal, setNewSpecVal] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    document.title = "Manage Products | Universal Cycles Admin";
  }, []);

  const availableBrands = Array.from(
    new Map(
      [
        ...dynamicBrands.map((b) => [b.name.toLowerCase(), b] as const),
        ...products
          .filter((p) => p.brand && p.brand.trim())
          .map((p) => [
            p.brand.toLowerCase(),
            { id: p.brand.toLowerCase().replace(/\s+/g, "-"), name: p.brand, slug: p.brand.toLowerCase().replace(/\s+/g, "-") },
          ] as const),
      ]
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));

  const filtered = products
    .filter((p) => {
      const matchQ = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      const selectedCatObj = CATEGORIES.find((c) => c.id === selectedCategory);
      const subIds = selectedCatObj?.subcategories?.map((s) => s.id) ?? [];
      const matchCat =
        selectedCategory === "all" ||
        p.categoryId === selectedCategory ||
        p.subcategoryId === selectedCategory ||
        subIds.includes(p.categoryId) ||
        (p.subcategoryId ? subIds.includes(p.subcategoryId) : false);
      const matchBrand = selectedBrand === "all" || p.brand.toLowerCase() === selectedBrand.toLowerCase();
      return matchQ && matchCat && matchBrand;
    })
    .sort((a, b) => {
      let valA: string | number, valB: string | number;
      switch (sortField) {
        case "price": valA = a.salePrice ?? a.price; valB = b.salePrice ?? b.price; break;
        case "stock": valA = a.stock; valB = b.stock; break;
        case "rating": valA = a.rating; valB = b.rating; break;
        default: valA = a.name; valB = b.name;
      }
      if (sortDir === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const openNew = () => {
    setEditingProduct(null);
    setForm({
      name: "",
      brand: "",
      price: "",
      salePrice: "",
      stock: "",
      weightKg: "",
      warrantyInfo: "1 Year Manufacturer Warranty",
      categoryId: "",
      subcategoryId: "",
      description: "",
      isActive: true,
      images: [],
      features: [
        "Precision-engineered frame built for Indian road and trail conditions",
        "Smooth drivetrain and responsive all-weather braking system",
        "Pre-delivery 25-point safety inspection by Universal Cycles",
      ],
      specifications: [
        { key: "Frame", value: "" },
        { key: "Fork", value: "" },
        { key: "Drivetrain", value: "" },
        { key: "Brakes", value: "" },
        { key: "Wheels", value: "" },
      ],
    });
    setNewImageUrl("");
    setNewFeature("");
    setNewSpecKey("");
    setNewSpecVal("");
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    const directCat = CATEGORIES.find((c) => c.id === p.categoryId || c.slug === p.categoryId);
    const parentCat = directCat
      ? undefined
      : CATEGORIES.find((c) =>
          c.subcategories?.some((s) => s.id === p.categoryId || s.slug === p.categoryId)
        );
    const resolvedCategoryId = directCat ? directCat.id : parentCat ? parentCat.id : p.categoryId;
    const resolvedSubcategoryId = p.subcategoryId || (parentCat ? p.categoryId : "");

    let resolvedWeight = p.weightKg ? String(p.weightKg) : "";
    if (!resolvedWeight && p.specifications?.Weight) {
      const matchKg = String(p.specifications.Weight).match(/(\d+(?:\.\d+)?)\s*kg/i);
      const matchG = String(p.specifications.Weight).match(/(\d+(?:\.\d+)?)\s*g\b/i);
      if (matchKg) resolvedWeight = matchKg[1];
      else if (matchG) resolvedWeight = String(Number((Number(matchG[1]) / 1000).toFixed(2)));
    }

    setForm({
      name: p.name,
      brand: p.brand,
      price: String(p.price),
      salePrice: p.salePrice ? String(p.salePrice) : "",
      stock: String(p.stock),
      weightKg: resolvedWeight,
      warrantyInfo: p.warrantyInfo || "1 Year Manufacturer Warranty",
      categoryId: resolvedCategoryId,
      subcategoryId: resolvedSubcategoryId,
      description: p.description,
      isActive: p.isActive,
      images: p.images && p.images.length > 0 ? [...p.images] : p.thumbnail ? [p.thumbnail] : [],
      features: Array.isArray(p.features) && p.features.length > 0 ? [...p.features] : [],
      specifications: Object.entries(p.specifications || {}).map(([key, value]) => ({ key, value: String(value) })),
    });
    setNewImageUrl("");
    setNewFeature("");
    setNewSpecKey("");
    setNewSpecVal("");
    setFormError("");
    setShowForm(true);
  };

  const handleSave = () => {
    const price = Number(form.price);
    const salePrice = form.salePrice ? Number(form.salePrice) : undefined;
    const stock = Number(form.stock);
    const weightKg = form.weightKg.trim() === "" ? undefined : Number(form.weightKg);
    if (!form.name.trim() || !form.description.trim() || !form.brand || !form.categoryId) {
      setFormError("Complete the name, description, brand, and category before saving.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setFormError("Enter a valid price greater than ₹0.");
      return;
    }
    if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= price)) {
      setFormError("Sale price must be greater than ₹0 and lower than the regular price.");
      return;
    }
    if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 1000)) {
      setFormError("Weight must be a number greater than 0 and up to 1000 kg, or leave it empty.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setFormError("Stock must be a whole number of 0 or more.");
      return;
    }
    const now = Date.now();
    const pendingImg = newImageUrl.trim();
    const mergedImages = pendingImg && !form.images.includes(pendingImg)
      ? [...form.images, pendingImg]
      : [...form.images];
    const finalImages = mergedImages.length > 0 ? mergedImages : ["/cycle.png"];

    const pendingFeature = newFeature.trim();
    const cleanedFeatures = form.features.map((f) => f.trim()).filter(Boolean);
    const mergedFeatures = pendingFeature && !cleanedFeatures.includes(pendingFeature)
      ? [...cleanedFeatures, pendingFeature]
      : cleanedFeatures;

    const pendingKey = newSpecKey.trim();
    const pendingVal = newSpecVal.trim();
    const cleanedSpecs = form.specifications.filter((s) => s.key.trim() && s.value.trim());
    const mergedSpecEntries = pendingKey && pendingVal
      ? [...cleanedSpecs.filter((s) => s.key.trim().toLowerCase() !== pendingKey.toLowerCase()), { key: pendingKey, value: pendingVal }]
      : cleanedSpecs;
    const customSpecs: Record<string, string> = {};
    for (const entry of mergedSpecEntries) {
      if (entry.key.trim() && entry.value.trim()) {
        customSpecs[entry.key.trim()] = entry.value.trim();
      }
    }

    const warrantyInfo = form.warrantyInfo.trim() || "1 Year Manufacturer Warranty";
    const finalSpecifications: Record<string, string> =
      Object.keys(customSpecs).length > 0
        ? {
            ...customSpecs,
            ...(weightKg ? { Weight: `${weightKg} kg` } : {}),
          }
        : {
            Brand: form.brand,
            Category: form.categoryId.replace(/-/g, " "),
            ...(weightKg ? { Weight: `${weightKg} kg` } : {}),
            Warranty: warrantyInfo,
          };

    const finalFeatures =
      mergedFeatures.length > 0
        ? mergedFeatures
        : [
            "Precision-engineered frame built for Indian road and trail conditions",
            "Smooth drivetrain and responsive all-weather braking system",
            "Pre-delivery 25-point safety inspection by Universal Cycles",
          ];

    if (editingProduct) {
      const wasOutOfStock = editingProduct.stock === 0;
      const isNowInStock = stock > 0;
      if (wasOutOfStock && isNowInStock) {
        sendStockRestockNotification(editingProduct.id, form.name.trim() || editingProduct.name);
      }
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: form.name.trim(),
                brand: form.brand,
                categoryId: form.categoryId,
                subcategoryId: form.subcategoryId || undefined,
                description: form.description.trim(),
                price,
                salePrice,
                stock,
                weightKg,
                warrantyInfo,
                isActive: form.isActive,
                images: mergedImages.length > 0 ? mergedImages : p.images?.length ? p.images : [p.thumbnail || "/cycle.png"],
                thumbnail: mergedImages[0] ?? p.thumbnail ?? "/cycle.png",
                features: finalFeatures,
                specifications: finalSpecifications,
                updatedAt: now,
              }
            : p
        )
      );
      setSuccessMsg("Product updated successfully!");
    } else {
      const newProduct: Product = {
        id: `p${Date.now()}`,
        name: form.name.trim(),
        brand: form.brand,
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId || undefined,
        description: form.description.trim(),
        price,
        salePrice,
        stock,
        weightKg,
        warrantyInfo,
        isActive: form.isActive,
        images: finalImages,
        thumbnail: finalImages[0] || "/cycle.png",
        variants: [],
        specifications: finalSpecifications,
        features: finalFeatures,
        rating: 0,
        reviewsCount: 0,
        tags: [form.brand.toLowerCase(), form.categoryId.toLowerCase()],
        createdAt: now,
        updatedAt: now,
      };
      setProducts((prev) => [newProduct, ...prev]);
      setSuccessMsg("Product created successfully!");
      sendPushNotification(
        `New Arrival: ${newProduct.name}!`,
        `Check out our latest ${newProduct.name} now in stock at Universal Cycles.`,
        `/products/${newProduct.id}`,
        {
          productName: newProduct.name,
          category: newProduct.categoryId,
          brand: newProduct.brand,
          tags: newProduct.tags,
        }
      );
    }
    setNewImageUrl("");
    setNewFeature("");
    setNewSpecKey("");
    setNewSpecVal("");
    setFormError("");
    setShowForm(false);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
    setSuccessMsg("Product deleted successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {successMsg && (
          <div className="bg-green-100/50 border border-green-500/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg("")} className="text-green-700/50 hover:text-green-700"><X size={16} /></button>
          </div>
        )}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Products</h1>
            <p className="text-muted-foreground text-sm">{products.length} total products</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} /> Add Product
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="Search products"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <select
            aria-label="Filter by category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by brand"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
          >
            <option value="all">All Brands (A–Z)</option>
            {availableBrands.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Product
                  </th>
                  <th
                    className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("price")}
                  >
                    <div className="flex items-center gap-1">Price <SortIcon field="price" currentField={sortField} currentDir={sortDir} /></div>
                  </th>
                  <th
                    className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("stock")}
                  >
                    <div className="flex items-center gap-1">Stock <SortIcon field="stock" currentField={sortField} currentDir={sortDir} /></div>
                  </th>
                  <th
                    className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("rating")}
                  >
                    <div className="flex items-center gap-1">Rating <SortIcon field="rating" currentField={sortField} currentDir={sortDir} /></div>
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                          <Image src={product.thumbnail} alt={product.name} fill sizes="60px" className="object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{formatPrice(product.salePrice ?? product.price)}</p>
                        {product.salePrice && (
                          <p className="text-xs text-muted-foreground line-through">{formatPrice(product.price)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-semibold",
                          product.stock === 0 ? "text-destructive font-bold" : product.stock <= 3 ? "text-amber-700 dark:text-amber-300 font-bold" : product.stock < 10 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400"
                        )}>
                          {product.stock === 0 ? "0 (Out)" : product.stock}
                        </span>
                        {product.stock <= 3 && settings.whatsappNumber && (
                          <a
                            href={getOwnerStockAlertWhatsAppLink(product.name, product.stock, settings.whatsappNumber)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Send WhatsApp stock alert for ${product.name}`}
                            title={`Send WhatsApp Stock Alert to Owner (${settings.whatsappNumber})`}
                            className="p-1 rounded-md bg-[#128C7E] text-white hover:bg-[#075E54] transition-colors"
                          >
                            <MessageSquare size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">⭐</span>
                        <span className="text-sm">{product.rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-1 rounded-full",
                        product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      )}>
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(product)}
                          aria-label={`Edit ${product.name}`}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(product.id)}
                          aria-label={`Delete ${product.name}`}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add / Edit Form Modal */}
        <AnimatePresence>
          {showForm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50"
                onClick={() => setShowForm(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-x-4 top-6 bottom-6 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[680px] sm:max-h-[88vh] bg-background border border-border rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
                  <div>
                    <h2 className="text-xl font-bold">{editingProduct ? `Edit Product: ${editingProduct.name}` : "Add New Product"}</h2>
                    <p className="text-xs text-muted-foreground">Every section below maps directly to the storefront Product Detail Page</p>
                  </div>
                  <button onClick={() => setShowForm(false)} aria-label="Close product modal" className="p-2 hover:bg-muted rounded-lg">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {formError && (
                    <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {formError}
                    </p>
                  )}

                  {/* Section 1: Product Header, Brand & Category (Matches Top Header & Breadcrumb) */}
                  <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">1. Product Header, Brand & Category</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                          className="rounded accent-primary w-4 h-4"
                        />
                        <span className="text-xs font-semibold">Active / Published</span>
                      </label>
                    </div>
                    <div>
                      <label htmlFor="product-name" className="block text-sm font-medium mb-1">Product Name</label>
                      <input
                        id="product-name"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. TrailBlazer MTB Pro 27.5"
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-medium"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="product-brand" className="block text-sm font-medium mb-1">Brand</label>
                        <select
                          id="product-brand"
                          value={form.brand}
                          onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
                        >
                          <option value="">Select brand</option>
                          {availableBrands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="product-category" className="block text-sm font-medium mb-1">Category</label>
                        <select
                          id="product-category"
                          value={form.categoryId}
                          onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, subcategoryId: "" }))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
                        >
                          <option value="">Select category</option>
                          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          {form.categoryId && !CATEGORIES.some((c) => c.id === form.categoryId) && (
                            <option value={form.categoryId}>{form.categoryId}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="product-subcategory" className="block text-sm font-medium mb-1">Subcategory</label>
                        <select
                          id="product-subcategory"
                          value={form.subcategoryId}
                          onChange={(e) => setForm((p) => ({ ...p, subcategoryId: e.target.value }))}
                          disabled={!form.categoryId || !(CATEGORIES.find((c) => c.id === form.categoryId)?.subcategories?.length)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm disabled:opacity-50"
                        >
                          <option value="">Select subcategory</option>
                          {(CATEGORIES.find((c) => c.id === form.categoryId)?.subcategories || []).map((sub) => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Product Image Gallery (Matches Main Gallery & Thumbnails) */}
                  <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">2. Product Image Gallery</p>
                    <div>
                      <label htmlFor="product-image-url" className="block text-xs text-muted-foreground mb-1.5">
                        Add image URLs (first image is used as the primary thumbnail)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="product-image-url"
                          type="url"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="flex-1 px-4 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newImageUrl.trim()) {
                                setForm((p) => ({ ...p, images: [...p.images, newImageUrl.trim()] }));
                                setNewImageUrl("");
                              }
                            }
                          }}
                        />
                        <button
                          id="add-image-btn"
                          type="button"
                          onClick={() => {
                            if (newImageUrl.trim()) {
                              setForm((p) => ({ ...p, images: [...p.images, newImageUrl.trim()] }));
                              setNewImageUrl("");
                            }
                          }}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    {form.images.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {form.images.map((url, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
                            <div className="relative w-12 h-12 rounded-lg border border-border overflow-hidden shrink-0 bg-muted">
                              <Image src={url} alt={`Preview ${idx + 1}`} fill sizes="60px" className="object-cover" />
                            </div>
                            <input
                              type="text"
                              aria-label={`Image URL ${idx + 1}`}
                              value={url}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  images: p.images.map((item, i) => (i === idx ? e.target.value : item)),
                                }))
                              }
                              className="min-w-0 flex-1 px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-xs font-mono"
                            />
                            {idx === 0 && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                                Primary
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={`Remove image ${idx + 1}`}
                              onClick={() => setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))}
                              className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Pricing, Stock, Weight & Warranty Badge */}
                  <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">3. Pricing, Stock, Weight & Warranty</p>
                      {Number(form.price) > 0 && Number(form.salePrice) > 0 && Number(form.salePrice) < Number(form.price) && (
                        <span className="text-xs font-bold text-green-800 bg-green-100 dark:bg-green-950 dark:text-green-300 px-2.5 py-0.5 rounded-full">
                          -{Math.round(((Number(form.price) - Number(form.salePrice)) / Number(form.price)) * 100)}% OFF · Save {formatPrice(Number(form.price) - Number(form.salePrice))}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="product-price" className="block text-sm font-medium mb-1">Price (₹)</label>
                        <input
                          id="product-price"
                          type="number"
                          value={form.price}
                          onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="product-sale-price" className="block text-sm font-medium mb-1">Sale Price (₹)</label>
                        <input
                          id="product-sale-price"
                          type="number"
                          value={form.salePrice}
                          onChange={(e) => setForm((p) => ({ ...p, salePrice: e.target.value }))}
                          placeholder="Optional"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="product-stock" className="block text-sm font-medium mb-1">Stock Quantity</label>
                        <input
                          id="product-stock"
                          type="number"
                          value={form.stock}
                          onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                          placeholder="0"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="product-weight" className="block text-sm font-medium mb-1">Weight (kg)</label>
                        <input
                          id="product-weight"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.weightKg}
                          onChange={(e) => setForm((p) => ({ ...p, weightKg: e.target.value }))}
                          placeholder="e.g. 14.5"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="product-warranty" className="block text-sm font-medium mb-1">Warranty Info (Trust Badge)</label>
                        <input
                          id="product-warranty"
                          type="text"
                          value={form.warrantyInfo}
                          onChange={(e) => setForm((p) => ({ ...p, warrantyInfo: e.target.value }))}
                          placeholder="e.g. 5 years frame warranty, 1 year components"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Description & Key Features (Matches "{product.name} Details" & "Key Features" Card) */}
                  <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">4. Product Details & Key Features</p>
                    <div>
                      <label htmlFor="product-description" className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        id="product-description"
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Product description..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="product-feature-input" className="block text-sm font-medium mb-1.5">
                        Key Features <span className="text-xs text-muted-foreground font-normal">(Editable bullet points shown on product page)</span>
                      </label>
                      {form.features.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {form.features.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Check size={16} className="text-green-600 shrink-0" />
                              <input
                                type="text"
                                aria-label={`Key feature ${idx + 1}`}
                                value={feat}
                                onChange={(e) =>
                                  setForm((p) => ({
                                    ...p,
                                    features: p.features.map((item, i) => (i === idx ? e.target.value : item)),
                                  }))
                                }
                                placeholder={`Feature ${idx + 1}`}
                                className="min-w-0 flex-1 px-3.5 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <button
                                type="button"
                                aria-label={`Remove feature ${idx + 1}`}
                                onClick={() => setForm((p) => ({ ...p, features: p.features.filter((_, i) => i !== idx) }))}
                                className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted shrink-0"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          id="product-feature-input"
                          type="text"
                          value={newFeature}
                          onChange={(e) => setNewFeature(e.target.value)}
                          placeholder="Add another key feature..."
                          className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newFeature.trim()) {
                                setForm((p) => ({ ...p, features: [...p.features, newFeature.trim()] }));
                                setNewFeature("");
                              }
                            }
                          }}
                        />
                        <button
                          id="add-feature-btn"
                          type="button"
                          onClick={() => {
                            if (newFeature.trim()) {
                              setForm((p) => ({ ...p, features: [...p.features, newFeature.trim()] }));
                              setNewFeature("");
                            }
                          }}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors shrink-0"
                        >
                          Add Feature
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section 5: Technical Specifications Table (Matches Storefront "Specifications" Table) */}
                  <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="product-spec-key" className="block text-xs font-bold uppercase tracking-wider text-primary">
                        5. Technical Specifications Table
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {["Frame", "Fork", "Drivetrain", "Brakes", "Wheels", "Age Range"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              const exists = form.specifications.some((s) => s.key.toLowerCase() === preset.toLowerCase());
                              if (!exists) {
                                setForm((p) => ({ ...p, specifications: [...p.specifications, { key: preset, value: "" }] }));
                              } else {
                                setNewSpecKey(preset);
                              }
                            }}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.specifications.length > 0 && (
                      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                        {form.specifications.map((spec, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "grid grid-cols-[1fr_1.3fr_auto] items-center gap-2 p-2",
                              idx % 2 === 0 ? "bg-muted/30" : "bg-background"
                            )}
                          >
                            <input
                              type="text"
                              aria-label={`Specification name ${idx + 1}`}
                              value={spec.key}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  specifications: p.specifications.map((item, i) =>
                                    i === idx ? { ...item, key: e.target.value } : item
                                  ),
                                }))
                              }
                              placeholder="Spec name (e.g. Frame)"
                              className="min-w-0 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                              type="text"
                              aria-label={`Specification value for ${spec.key || idx + 1}`}
                              value={spec.value}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  specifications: p.specifications.map((item, i) =>
                                    i === idx ? { ...item, value: e.target.value } : item
                                  ),
                                }))
                              }
                              placeholder={`Enter ${spec.key || "specification"} value...`}
                              className="min-w-0 px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                              type="button"
                              aria-label={`Remove specification ${spec.key || idx + 1}`}
                              onClick={() => setForm((p) => ({ ...p, specifications: p.specifications.filter((_, i) => i !== idx) }))}
                              className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 pt-1">
                      <input
                        id="product-spec-key"
                        type="text"
                        value={newSpecKey}
                        onChange={(e) => setNewSpecKey(e.target.value)}
                        placeholder="New spec name (e.g. Handlebar)"
                        className="px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                      />
                      <input
                        id="product-spec-val"
                        type="text"
                        value={newSpecVal}
                        onChange={(e) => setNewSpecVal(e.target.value)}
                        placeholder="Value (e.g. Alloy Riser 720mm)"
                        className="px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newSpecKey.trim() && newSpecVal.trim()) {
                              setForm((p) => ({
                                ...p,
                                specifications: [
                                  ...p.specifications.filter((s) => s.key.toLowerCase() !== newSpecKey.trim().toLowerCase()),
                                  { key: newSpecKey.trim(), value: newSpecVal.trim() },
                                ],
                              }));
                              setNewSpecKey("");
                              setNewSpecVal("");
                            }
                          }
                        }}
                      />
                      <button
                        id="add-spec-btn"
                        type="button"
                        onClick={() => {
                          if (newSpecKey.trim() && newSpecVal.trim()) {
                            setForm((p) => ({
                              ...p,
                              specifications: [
                                ...p.specifications.filter((s) => s.key.toLowerCase() !== newSpecKey.trim().toLowerCase()),
                                { key: newSpecKey.trim(), value: newSpecVal.trim() },
                              ],
                            }));
                            setNewSpecKey("");
                            setNewSpecVal("");
                          }
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors shrink-0"
                      >
                        Add Spec
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t flex gap-3">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl border border-border font-semibold hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check size={18} /> {editingProduct ? "Save Changes" : "Create Product"}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Delete Confirm */}
        <AnimatePresence>
          {deleteId && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] bg-background border border-border rounded-2xl p-6 z-50 shadow-2xl"
              >
                <h3 className="text-lg font-bold mb-2">Delete Product?</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  This action cannot be undone. The product will be permanently removed.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteId(null)}
                    className="flex-1 py-3 rounded-xl border border-border font-semibold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteId)}
                    className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
