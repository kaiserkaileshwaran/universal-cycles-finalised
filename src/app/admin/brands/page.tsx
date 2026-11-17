"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Check, Award, Search, ArrowDownAZ } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useBrands, type Brand } from "@/contexts/brands-context";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminBrandsPage() {
  const { brands, setBrands } = useBrands();
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState<{ name: string; slug: string }>({ name: "", slug: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    document.title = "Manage Brands | Universal Cycles Admin";
  }, []);

  const handleEdit = (b: Brand) => {
    setEditingBrand(b);
    setForm({ name: b.name, slug: b.slug });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setFormError("Please enter a brand name before saving.");
      return;
    }
    const name = form.name.trim();
    const slug = (form.slug.trim() || name.toLowerCase()).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    
    if (editingBrand) {
      setBrands(prev => {
        const list: Brand[] = Array.isArray(prev) ? prev : (Object.values(prev || {}) as Brand[]);
        const updated = list.map(b => b.id === editingBrand.id ? { ...b, name, slug } : b);
        return updated.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
      });
      setSuccessMsg(`Brand "${name}" updated successfully!`);
    } else {
      setBrands(prev => {
        const list: Brand[] = Array.isArray(prev) ? prev : (Object.values(prev || {}) as Brand[]);
        const updated = [...list, { id: slug, name, slug }];
        return updated.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
      });
      setSuccessMsg(`Brand "${name}" added in alphabetical order (A–Z)!`);
    }
    
    setShowForm(false);
    setEditingBrand(null);
    setForm({ name: "", slug: "" });
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = (id: string) => {
    setBrands(prev => {
      const list: Brand[] = Array.isArray(prev) ? prev : (Object.values(prev || {}) as Brand[]);
      return list.filter(b => b.id !== id);
    });
    setSuccessMsg("Brand deleted successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {successMsg && (
          <div className="bg-green-100/60 border border-green-500/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between shadow-sm animate-in fade-in duration-200">
            <span className="font-medium">{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="text-green-700/60 hover:text-green-700 dark:text-green-400/60 dark:hover:text-green-300">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Brand Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage cycle brands available in your store. All brands are automatically maintained in alphabetical order (A–Z).
            </p>
          </div>
          <button 
            onClick={() => { setEditingBrand(null); setForm({ name: "", slug: "" }); setShowForm(true); }}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus size={18} /> Add Brand
          </button>
        </div>

        {/* Alphabetical Order Notice Banner */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-xs sm:text-sm text-foreground/80">
          <ArrowDownAZ size={18} className="text-primary shrink-0" />
          <span>
            <strong className="text-primary font-semibold">Alphabetical (A–Z) Ordering Active:</strong> Brands are automatically displayed alphabetically on product pages, filter sidebars, search results, and admin selectors. Any new brand you add is automatically placed in its correct alphabetical position.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Award size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Brands</p>
              <p className="text-2xl font-bold text-foreground">{brands.length}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <ArrowDownAZ size={22} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sort Order</p>
              <p className="text-sm font-semibold text-foreground">Alphabetical (A to Z)</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search brands by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground w-16">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brand Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slug</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBrands.map((b, idx) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground font-semibold">
                      #{idx + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/20 shrink-0">
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground text-sm">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{b.slug}</td>
                    <td className="px-5 py-4 text-right">
                      <button 
                        onClick={() => handleEdit(b)} 
                        className="p-1.5 hover:bg-muted rounded-lg mr-1 text-muted-foreground hover:text-primary transition-colors"
                        title="Edit brand"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(b.id)} 
                        className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete brand"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBrands.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">
                      {searchQuery ? `No brands matching "${searchQuery}"` : "No brands found. Click Add Brand to create one."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs" onClick={() => setShowForm(false)} />
              <motion.div initial={{ opacity: 0, x: "100%" }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
                <div className="p-6 border-b flex items-center justify-between">
                  <h2 className="text-xl font-bold">{editingBrand ? "Edit Brand" : "Add Brand"}</h2>
                  <button onClick={() => setShowForm(false)} aria-label="Close brand modal" className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {formError && (
                    <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {formError}
                    </p>
                  )}
                  <div>
                    <label htmlFor="brand-name" className="block text-sm font-medium mb-1">Brand Name</label>
                    <input 
                      id="brand-name"
                      type="text" 
                      value={form.name} 
                      onChange={(e) => setForm({ name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} 
                      placeholder="e.g. Scott, Trek, Hero..." 
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" 
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      The brand will automatically be placed in its alphabetical order in the store.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="brand-slug" className="block text-sm font-medium mb-1">Slug</label>
                    <input 
                      id="brand-slug"
                      type="text" 
                      value={form.slug} 
                      onChange={(e) => setForm(p => ({ ...p, slug: e.target.value }))} 
                      placeholder="e.g. scott" 
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono" 
                    />
                  </div>
                </div>
                <div className="p-6 border-t flex gap-3">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-border font-semibold hover:bg-muted transition-colors">Cancel</button>
                  <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Check size={18} /> {editingBrand ? "Save Changes" : "Create Brand"}
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
