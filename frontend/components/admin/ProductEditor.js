"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Trash2, Upload, Plus, X, Star, ExternalLink, Loader2, PlayCircle } from 'lucide-react';
import { getCategories, saveAdminProduct, deleteAdminProduct, uploadAdminImage } from '../../lib/api';
import { getYouTubeId, isYouTubeShortUrl, youTubeThumbnail } from '../../lib/youtube';
import { Card, Button, Field, Toggle, inputClass, useToast, formatMoney } from './ui';

const EMPTY = {
  name: '',
  tagline: '',
  description: '',
  category_id: '',
  base_price: '',
  discount: 0,
  stock: 10,
  sku: '',
  images: [],
  highlights: [''],
  videos: [],
  is_active: true,
  is_featured: false,
  featured_order: 0,
};

function fromProduct(p) {
  return {
    name: p.name || '',
    tagline: p.tagline || '',
    description: p.description || '',
    category_id: p.category_id || '',
    base_price: p.priceValue || '',
    discount: p.discount || 0,
    stock: p.stock ?? 0,
    sku: p.variants?.[0]?.sku || '',
    images: p.images || [],
    highlights: p.highlights?.length ? p.highlights : [''],
    videos: (p.videos || []).map((v) => ({ id: v.id, url: v.url, title: v.title || '', is_short: !!v.is_short })),
    is_active: !!p.is_active,
    is_featured: !!p.is_featured,
    featured_order: p.featured_order || 0,
  };
}

export default function ProductEditor({ product = null }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(product ? fromProduct(product) : EMPTY);
  const [categories, setCategories] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const salePrice = Math.round(Number(form.base_price || 0) * (1 - Number(form.discount || 0) / 100));

  // ── Photos ──
  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (form.images.length + files.length > 12) return toast('A product can have at most 12 photos.', 'error');
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const url = await uploadAdminImage(file, 'products');
        setForm((f) => ({ ...f, images: [...f.images, url] }));
        setDirty(true);
      } catch (err) {
        toast(`${file.name}: ${err.message}`, 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const moveImage = (idx, dir) => {
    const next = [...form.images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    set('images', next);
  };

  const makeCover = (idx) => {
    const next = [...form.images];
    const [img] = next.splice(idx, 1);
    set('images', [img, ...next]);
  };

  // ── Highlights & videos ──
  const setHighlight = (i, v) => set('highlights', form.highlights.map((h, idx) => (idx === i ? v : h)));
  const setVideo = (i, patch) =>
    set(
      'videos',
      form.videos.map((v, idx) => {
        if (idx !== i) return v;
        const next = { ...v, ...patch };
        if (patch.url !== undefined && isYouTubeShortUrl(patch.url)) next.is_short = true;
        return next;
      })
    );

  const save = async (e) => {
    e.preventDefault();
    if (!form.images.length && !window.confirm('This product has no photos. Save anyway?')) return;
    const badVideo = form.videos.find((v) => v.url.trim() && !getYouTubeId(v.url));
    if (badVideo) return toast(`"${badVideo.url}" is not a valid YouTube link.`, 'error');

    setSaving(true);
    try {
      const saved = await saveAdminProduct(product?.id || null, {
        ...form,
        highlights: form.highlights.map((h) => h.trim()).filter(Boolean),
        videos: form.videos.filter((v) => v.url.trim()),
      });
      setDirty(false);
      toast(product ? 'Product saved' : 'Product created');
      if (!product) router.replace(`/admin/products/${saved.id}`);
      else setForm(fromProduct(saved));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${product.name}" permanently? Tip: you can switch it off instead to keep its history.`)) return;
    setDeleting(true);
    try {
      await deleteAdminProduct(product.id);
      setDirty(false);
      toast('Product deleted');
      router.replace('/admin/products');
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={save} className="pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900">
          <ChevronLeft className="w-4 h-4" /> Products
        </Link>
        {product && (
          <Link href={`/shop/${product.id}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600">
            View in store <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-6">{product ? `Edit: ${product.name}` : 'New product'}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card title="Details">
            <div className="flex flex-col gap-4">
              <Field label="Product title *">
                <input required maxLength={120} className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sunflower Crochet Tote" />
              </Field>
              <Field label="Tagline" hint="One catchy line shown under the title on the homepage and product page.">
                <input maxLength={160} className={inputClass} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Hand-knitted, sunshine-yellow, made to carry your day" />
              </Field>
              <Field label="Description" hint="Tell the story: materials, size, care instructions, what makes it special.">
                <textarea rows={6} maxLength={5000} className={`${inputClass} resize-y`} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
              <Field label="Category">
                <select className={inputClass} value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
                  <option value="">— No category —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
          </Card>

          <Card
            title={`Photos (${form.images.length}/12)`}
            actions={uploading > 0 && <span className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading {uploading}…</span>}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {form.images.map((src, idx) => (
                <div key={src} className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 border-2 ${idx === 0 ? 'border-indigo-500' : 'border-transparent'}`}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  {idx === 0 && <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-black uppercase">Cover</span>}
                  <button type="button" onClick={() => set('images', form.images.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 text-red-600 flex items-center justify-center shadow" aria-label="Remove photo">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-1 inset-x-1 flex justify-between">
                    <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0} className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-30" aria-label="Move left">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {idx !== 0 && (
                      <button type="button" onClick={() => makeCover(idx)} className="px-2 h-7 rounded-full bg-white/90 text-[10px] font-bold flex items-center gap-1" title="Make cover photo">
                        <Star className="w-3 h-3" /> Cover
                      </button>
                    )}
                    <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === form.images.length - 1} className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center disabled:opacity-30" aria-label="Move right">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {form.images.length < 12 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-500 cursor-pointer hover:border-indigo-400 hover:text-indigo-600">
                  <Upload className="w-5 h-5" />
                  <span className="text-[11px] font-bold">Add photos</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">First photo is the cover. Square or portrait photos (min 1000px) look best. JPG/PNG/WEBP up to 5 MB each.</p>
          </Card>

          <Card title="Highlights" actions={<span className="text-[11px] text-slate-400">Shown as ✓ bullet points</span>}>
            <div className="flex flex-col gap-2">
              {form.highlights.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputClass} maxLength={120} value={h} onChange={(e) => setHighlight(i, e.target.value)} placeholder={['100% acrylic wool, super soft', 'Size: 30 × 25 cm', 'Gift-ready packaging'][i] || 'Another highlight'} />
                  <button type="button" onClick={() => set('highlights', form.highlights.filter((_, idx) => idx !== i))} className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Remove highlight">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {form.highlights.length < 8 && (
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => set('highlights', [...form.highlights, ''])}>
                  <Plus className="w-4 h-4" /> Add highlight
                </Button>
              )}
            </div>
          </Card>

          <Card title={`YouTube videos (${form.videos.length}/6)`} actions={<span className="text-[11px] text-slate-400">2–3 recommended</span>}>
            <div className="flex flex-col gap-4">
              {form.videos.map((v, i) => {
                const vid = getYouTubeId(v.url);
                return (
                  <div key={i} className="flex gap-3 items-start bg-slate-50 rounded-2xl p-3">
                    <div className={`shrink-0 rounded-lg overflow-hidden bg-slate-200 ${v.is_short ? 'w-14 h-24' : 'w-28 h-16'}`}>
                      {vid ? <img src={youTubeThumbnail(vid, 'mqdefault')} alt="" className="w-full h-full object-cover" /> : <PlayCircle className="w-6 h-6 m-auto mt-5 text-slate-400" />}
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <input className={inputClass} value={v.url} onChange={(e) => setVideo(i, { url: e.target.value })} placeholder="https://youtube.com/shorts/… or youtu.be/…" />
                      {v.url && !vid && <span className="text-[11px] text-red-600 font-semibold">Not a valid YouTube link</span>}
                      <input className={inputClass} maxLength={120} value={v.title} onChange={(e) => setVideo(i, { title: e.target.value })} placeholder="Title (optional), e.g. How it's made" />
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={v.is_short} onChange={(e) => setVideo(i, { is_short: e.target.checked })} className="accent-indigo-600" />
                        Vertical video (YouTube Short / reel)
                      </label>
                    </div>
                    <button type="button" onClick={() => set('videos', form.videos.filter((_, idx) => idx !== i))} className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Remove video">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {form.videos.length < 6 && (
                <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => set('videos', [...form.videos, { url: '', title: '', is_short: false }])}>
                  <Plus className="w-4 h-4" /> Add YouTube video
                </Button>
              )}
              <p className="text-[11px] text-slate-400">Upload the video to YouTube (Unlisted is fine) and paste the link. Nothing is uploaded to this site, so pages stay fast. The first video also appears in the homepage section.</p>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Visibility">
            <Toggle checked={form.is_active} onChange={(v) => set('is_active', v)} label="Live in store" description="Off = hidden from shop, homepage and checkout (existing orders unaffected)." />
            <Toggle checked={form.is_featured} onChange={(v) => set('is_featured', v)} label="Show on homepage" description="Gets its own full-width brand section with photos, highlights & video." />
            {form.is_featured && (
              <Field label="Homepage position" hint="Lower numbers show first." className="mt-2">
                <input type="number" min={0} max={999} className={inputClass} value={form.featured_order} onChange={(e) => set('featured_order', e.target.value)} />
              </Field>
            )}
          </Card>

          <Card title="Price & stock">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (MRP) ₹ *" className="col-span-2">
                <input required type="number" min={1} step="1" inputMode="numeric" className={inputClass} value={form.base_price} onChange={(e) => set('base_price', e.target.value)} />
              </Field>
              <Field label="Discount %">
                <input type="number" min={0} max={90} step="1" inputMode="numeric" className={inputClass} value={form.discount} onChange={(e) => set('discount', e.target.value)} />
              </Field>
              <Field label="Stock *">
                <input required type="number" min={0} step="1" inputMode="numeric" className={inputClass} value={form.stock} onChange={(e) => set('stock', e.target.value)} />
              </Field>
              <Field label="SKU (optional)" className="col-span-2">
                <input className={inputClass} maxLength={60} value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto-generated if empty" />
              </Field>
            </div>
            {Number(form.base_price) > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                Customer pays <strong className="text-slate-900">{formatMoney(salePrice)}</strong>
                {Number(form.discount) > 0 && <span className="text-slate-400"> (was {formatMoney(form.base_price)})</span>}
              </p>
            )}
          </Card>

          <div className="hidden md:flex flex-col gap-2">
            <Button type="submit" size="lg" loading={saving} disabled={uploading > 0}>{product ? 'Save changes' : 'Create product'}</Button>
            {product && (
              <Button type="button" variant="ghost" className="!text-red-600" loading={deleting} onClick={remove}>
                <Trash2 className="w-4 h-4" /> Delete product
              </Button>
            )}
          </div>
          {product && (
            <Button type="button" variant="ghost" className="md:hidden !text-red-600" loading={deleting} onClick={remove}>
              <Trash2 className="w-4 h-4" /> Delete product
            </Button>
          )}
        </div>
      </div>

      {/* Mobile save bar (sits above the admin bottom tabs) */}
      <div className="md:hidden fixed bottom-[58px] inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3">
        <Button type="submit" size="lg" className="w-full" loading={saving} disabled={uploading > 0}>
          {product ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}
