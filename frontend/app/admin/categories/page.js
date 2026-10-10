"use client";

import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, Loader2 } from 'lucide-react';
import { getCategories, saveAdminCategory, deleteAdminCategory, uploadAdminImage, getAdminProducts, invalidateClientCache } from '../../../lib/api';
import { Card, PageHeader, Button, Field, Modal, Spinner, EmptyState, inputClass, useToast } from '../../../components/admin/ui';

const EMPTY = { name: '', slug: '', description: '', image_url: '', sort_order: 0 };

export default function AdminCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState(null);
  const [counts, setCounts] = useState({});
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    invalidateClientCache('categories');
    try {
      const [cats, products] = await Promise.all([getCategories(), getAdminProducts()]);
      setCategories(cats);
      const c = {};
      products.forEach((p) => p.category_id && (c[p.category_id] = (c[p.category_id] || 0) + 1));
      setCounts(c);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (cat = null) => {
    setEditing(cat || 'new');
    setForm(cat ? { name: cat.name, slug: cat.slug, description: cat.description || '', image_url: cat.image_url || '', sort_order: cat.sort_order || 0 } : EMPTY);
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAdminImage(file, 'categories');
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAdminCategory(editing === 'new' ? null : editing.id, form);
      toast('Category saved');
      setEditing(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cat) => {
    if (!window.confirm(`Delete "${cat.name}"? Its ${counts[cat.id] || 0} products will become uncategorised (not deleted).`)) return;
    try {
      await deleteAdminCategory(cat.id);
      toast('Category deleted');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!categories) return <Spinner />;

  return (
    <>
      <PageHeader title="Categories" subtitle="Group products so shoppers can browse easily" actions={<Button onClick={() => open()}><Plus className="w-4 h-4" /> Add category</Button>} />
      <Card padded={false}>
        {categories.length === 0 ? (
          <EmptyState title="No categories yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 md:px-6 py-3">
                <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                  {c.image_url && <img src={c.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{counts[c.id] || 0} products · /{c.slug}</p>
                </div>
                <button onClick={() => open(c)} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(c)} className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New category' : 'Edit category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} loading={saving} disabled={uploading || !form.name.trim()}>Save</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name *"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><textarea rows={2} className={`${inputClass} resize-none`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="URL slug" hint="Auto from name if empty"><input className={inputClass} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
            <Field label="Display order"><input type="number" min={0} className={inputClass} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
          </div>
          <Field label="Cover image">
            <div className="flex items-center gap-3">
              <div className="w-20 h-24 rounded-xl bg-slate-100 overflow-hidden">{form.image_url && <img src={form.image_url} alt="" className="w-full h-full object-cover" />}</div>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold cursor-pointer hover:bg-slate-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {form.image_url ? 'Replace' : 'Upload'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
              </label>
            </div>
          </Field>
        </div>
      </Modal>
    </>
  );
}
