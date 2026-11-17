/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Plus, Edit2, Trash2, X, Check, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useCategories } from "@/contexts/categories-context";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminCategoriesPage() {
  const { categories, setCategories } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    slug: "",
    description: "",
    subcategories: [] as { id: string; name: string; slug: string; order?: number }[]
  });
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    document.title = "Manage Categories | Universal Cycles Admin";
  }, []);

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"above" | "below" | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const isAbove = e.clientY < rect.top + rect.height / 2;
    setDragOverIndex(index);
    setDropPosition(isAbove ? "above" : "below");
  };

  const handleDragLeave = () => {
    // Keep target index until next dragOver or dragEnd
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === undefined) return;
    if (draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDropPosition(null);
      return;
    }

    const updated = [...categories];
    const [movedItem] = updated.splice(draggedIndex, 1);

    let insertIndex = targetIndex;
    if (dropPosition === "below") {
      insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + 1;
    } else {
      insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    }
    insertIndex = Math.max(0, Math.min(updated.length, insertIndex));

    updated.splice(insertIndex, 0, movedItem);
    const reordered = updated.map((item, idx) => ({ ...item, order: idx }));
    setCategories(reordered);
    setSuccessMsg(`"${movedItem.name}" reordered to position #${insertIndex + 1}!`);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const updated = [...categories];
    const [item] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, item);
    const reordered = updated.map((c, idx) => ({ ...c, order: idx }));
    setCategories(reordered);
    setSuccessMsg(`Moved "${item.name}" ${direction === "up" ? "up" : "down"} to position #${targetIndex + 1}!`);
    setTimeout(() => setSuccessMsg(""), 2500);
  };

  const handleEdit = (c: any) => {
    setEditingCategory(c);
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      subcategories: c.subcategories || []
    });
    setShowForm(true);
  };

  const handleMoveSubcategory = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= form.subcategories.length) return;
    const updated = [...form.subcategories];
    const [item] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, item);
    setForm(p => ({
      ...p,
      subcategories: updated.map((s, idx) => ({ ...s, order: idx }))
    }));
  };

  const handleSave = () => {
    const cleanName = form.name.trim();
    const cleanSlug = (form.slug.trim() || cleanName.toLowerCase()).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!cleanName || !cleanSlug) {
      setFormError("Please enter a category name before saving.");
      return;
    }

    // Capture any pending subcategory typed in the input box that hasn't been added yet
    const subInput = typeof document !== "undefined" ? (document.getElementById("new-sub-input") as HTMLInputElement | null) : null;
    const finalSubcategories = [...(form.subcategories || [])];
    if (subInput && subInput.value.trim()) {
      const val = subInput.value.trim();
      const subId = val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (subId && !finalSubcategories.some(s => s.name.toLowerCase() === val.toLowerCase() || s.id === subId)) {
        finalSubcategories.push({ id: subId, name: val, slug: subId, order: finalSubcategories.length });
      }
      subInput.value = "";
    }

    if (editingCategory) {
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? { 
        ...c, 
        name: cleanName, 
        slug: cleanSlug, 
        description: form.description.trim(), 
        subcategories: finalSubcategories.map((s, idx) => ({ ...s, order: idx }))
      } : c));
      setSuccessMsg("Category updated successfully!");
    } else {
      setCategories(prev => [
        ...prev, 
        { 
          id: cleanSlug, 
          name: cleanName, 
          slug: cleanSlug, 
          description: form.description.trim(), 
          order: prev.length,
          subcategories: finalSubcategories.map((s, idx) => ({ ...s, order: idx }))
        }
      ]);
      setSuccessMsg("Category created successfully!");
    }
    setFormError("");
    setShowForm(false);
    setEditingCategory(null);
    setForm({ id: "", name: "", slug: "", description: "", subcategories: [] });
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id).map((c, idx) => ({ ...c, order: idx })));
    setSuccessMsg("Category deleted successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

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
            <h1 className="text-2xl md:text-3xl font-bold">Categories</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage product categories, subcategories, and customize their store display order.
            </p>
          </div>
          <button 
            onClick={() => { setEditingCategory(null); setForm({ id: "", name: "", slug: "", description: "", subcategories: [] }); setShowForm(true); }}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={18} /> Add Category
          </button>
        </div>

        {/* Drag & Drop Reorder Tip Banner */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-xs sm:text-sm text-foreground/80">
          <GripVertical size={16} className="text-primary shrink-0 cursor-grab" />
          <span>
            <strong className="text-primary font-semibold">Hold & Drag to Reorder:</strong> Press and hold the grip icon on any row to drag and drop it into your preferred order, or use the <ChevronUp size={13} className="inline -mt-0.5 text-primary" /> <ChevronDown size={13} className="inline -mt-0.5 text-primary" /> arrows. The order is automatically saved and updated in the client navigation and category sidebars.
          </span>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-28">Order</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Category</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Slug</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Subcategories</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category, index) => {
                  const isBeingDragged = draggedIndex === index;
                  const isOver = dragOverIndex === index;

                  return (
                    <tr 
                      key={category.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`transition-all duration-150 group ${
                        isBeingDragged
                          ? "opacity-30 bg-muted/70 scale-[0.99] border-dashed border-2 border-primary/50"
                          : isOver
                            ? dropPosition === "above"
                              ? "border-t-2 border-t-primary bg-primary/10 shadow-[0_-2px_8px_rgba(59,130,246,0.3)]"
                              : "border-b-2 border-b-primary bg-primary/10 shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
                            : "hover:bg-muted/30"
                      }`}
                    >
                      {/* Order Handle & Rank */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="p-1 rounded text-muted-foreground/60 hover:text-primary cursor-grab active:cursor-grabbing transition-colors"
                            title="Hold to drag and reorder"
                            onMouseDown={(e) => {
                              const tr = (e.currentTarget as HTMLElement).closest("tr");
                              if (tr) tr.draggable = true;
                            }}
                          >
                            <GripVertical size={16} />
                          </button>

                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                            #{index + 1}
                          </span>

                          <div className="flex flex-col ml-0.5">
                            <button
                              type="button"
                              onClick={() => handleMove(index, "up")}
                              disabled={index === 0}
                              title="Move Up"
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                            >
                              <ChevronUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(index, "down")}
                              disabled={index === categories.length - 1}
                              title="Move Down"
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                            >
                              <ChevronDown size={13} />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-sm text-foreground">{category.name}</p>
                        {category.description ? (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{category.description}</p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 text-sm font-mono text-muted-foreground">{category.slug}</td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {category.subcategories && category.subcategories.length > 0 ? (
                            category.subcategories.map((sub, sIdx) => (
                              <span 
                                key={sub.id || sIdx} 
                                className="text-xs bg-muted text-foreground/80 border border-border/60 px-2 py-0.5 rounded-md flex items-center gap-1"
                              >
                                {sub.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">No subcategories</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleEdit(category)} 
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                            title="Edit Category"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={() => handleDelete(category.id)} 
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                            title="Delete Category"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-muted-foreground">
                      No categories found. Click &quot;Add Category&quot; to create one.
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs"
                onClick={() => setShowForm(false)}
              />
              <motion.div
                initial={{ opacity: 0, x: "100%" }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col"
              >
                <div className="p-6 border-b flex items-center justify-between">
                  <h2 className="text-xl font-bold">{editingCategory ? "Edit Category" : "Add Category"}</h2>
                  <button onClick={() => setShowForm(false)} aria-label="Close category modal" className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {formError && (
                    <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {formError}
                    </p>
                  )}
                  <div>
                    <label htmlFor="category-name" className="block text-sm font-medium mb-1">Category Name</label>
                    <input
                      id="category-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }))}
                      placeholder="e.g. Mountain Bikes"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="category-slug" className="block text-sm font-medium mb-1">Slug</label>
                    <input
                      id="category-slug"
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                      placeholder="e.g. mountain-bikes"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="category-description" className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      id="category-description"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      rows={3}
                      placeholder="Brief category description..."
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Subcategories</label>
                    <p className="text-xs text-muted-foreground mb-2">Type subcategory name and click Add or press Enter.</p>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="e.g. Hardtail, Full Suspension..."
                        id="new-sub-input"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              setForm(p => ({
                                ...p,
                                subcategories: [
                                  ...p.subcategories,
                                  {
                                    id: val.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                                    name: val,
                                    slug: val.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                                    order: p.subcategories.length
                                  }
                                ]
                              }));
                              e.currentTarget.value = "";
                            }
                          }
                        }}
                      />
                      <button
                        id="add-subcategory-btn"
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("new-sub-input") as HTMLInputElement;
                          const val = input.value.trim();
                          if (val) {
                            setForm(p => ({
                              ...p,
                              subcategories: [
                                ...p.subcategories,
                                {
                                  id: val.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                                  name: val,
                                  slug: val.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                                  order: p.subcategories.length
                                }
                              ]
                            }));
                            input.value = "";
                          }
                        }}
                        className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
                      >
                        Add
                      </button>
                    </div>

                    {form.subcategories.length > 0 && (
                      <div className="space-y-1.5 mt-3 max-h-56 overflow-y-auto p-1 border border-border/60 rounded-xl bg-muted/10">
                        {form.subcategories.map((sub, idx) => (
                          <div 
                            key={sub.id || idx} 
                            className="flex items-center justify-between bg-card border border-border px-3 py-2 rounded-lg text-sm"
                          >
                            <span className="font-medium text-foreground">{sub.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveSubcategory(idx, "up")}
                                disabled={idx === 0}
                                title="Move up"
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSubcategory(idx, "down")}
                                disabled={idx === form.subcategories.length - 1}
                                title="Move down"
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setForm(p => ({ ...p, subcategories: p.subcategories.filter((_, i) => i !== idx) }))}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
                                title="Remove subcategory"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6 border-t flex gap-3">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-border font-semibold hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Check size={18} /> {editingCategory ? "Save Changes" : "Create"}
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
