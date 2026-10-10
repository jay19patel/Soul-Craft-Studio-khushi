"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Star, PlayCircle } from 'lucide-react';
import {
  getAdminTestimonials, saveAdminTestimonial, setAdminTestimonialFlags, deleteAdminTestimonial, getAdminProducts,
} from '../../../lib/api';
import { getYouTubeId, isYouTubeShortUrl, youTubeThumbnail } from '../../../lib/youtube';
import { Card, PageHeader, Button, Field, Modal, Spinner, EmptyState, Switch, Pill, Toggle, inputClass, useToast, timeAgo } from '../../../components/admin/ui';

const EMPTY = { author_name: '', author_location: '', content: '', rating: 5, video_url: '', is_short: false, product_id: '', is_active: true, is_featured: false };

const TABS = [
  { key: 'pending', label: 'To approve' },
  { key: 'live', label: 'Live' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'all', label: 'All' },
];

export default function AdminReviewsPage() {
  const toast = useToast();
  const [reviews, setReviews] = useState(null);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([getAdminTestimonials(), getAdminProducts()])
      .then(([r, p]) => {
        setReviews(r);
        setProducts(p);
        if (r.some((x) => !x.is_active && !x.reviewed)) setTab((t) => (t === 'all' ? 'pending' : t));
      })
      .catch((err) => toast(err.message, 'error'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productName = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.name])), [products]);

  const visible = (reviews || []).filter((r) => {
    if (tab === 'pending') return !r.is_active && !r.reviewed;
    if (tab === 'live') return r.is_active;
    if (tab === 'hidden') return !r.is_active && r.reviewed;
    return true;
  });

  const open = (r = null) => {
    setEditing(r || 'new');
    setForm(r ? { ...EMPTY, ...r, product_id: r.product_id || '' } : EMPTY);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveAdminTestimonial(editing === 'new' ? null : editing.id, form);
      toast('Review saved');
      setEditing(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const flag = async (r, flags, msg) => {
    try {
      const updated = await setAdminTestimonialFlags(r.id, flags);
      setReviews((list) => list.map((x) => (x.id === r.id ? { ...updated, reviewed: true } : x)));
      toast(msg);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete review by ${r.author_name}?`)) return;
    try {
      await deleteAdminTestimonial(r.id);
      setReviews((list) => list.filter((x) => x.id !== r.id));
      toast('Review deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!reviews) return <Spinner />;
  const vid = getYouTubeId(form.video_url);

  return (
    <>
      <PageHeader
        title="Reviews & customer stories"
        subtitle="Text and YouTube video reviews shown on the homepage and product pages"
        actions={<Button onClick={() => open()}><Plus className="w-4 h-4" /> Add review</Button>}
      />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
        {TABS.map((t) => {
          const count = t.key === 'pending' ? reviews.filter((r) => !r.is_active && !r.reviewed).length : null;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border ${tab === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
              {t.label}{count ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      <Card padded={false}>
        {visible.length === 0 ? (
          <EmptyState title="No reviews here" text="Add video reviews from customers' unboxing clips (YouTube Shorts work great)." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((r) => (
              <li key={r.id} className="flex flex-col sm:flex-row gap-3 px-4 md:px-6 py-4">
                {r.youtube_id && (
                  <div className={`shrink-0 rounded-xl overflow-hidden bg-slate-200 relative ${r.is_short ? 'w-16 h-28' : 'w-32 h-20'}`}>
                    <img src={youTubeThumbnail(r.youtube_id, 'mqdefault')} alt="" className="w-full h-full object-cover" />
                    <PlayCircle className="absolute inset-0 m-auto w-7 h-7 text-white drop-shadow" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{r.author_name}</span>
                    <span className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}</span>
                    {r.source === 'customer' ? <Pill tone="blue">Customer</Pill> : <Pill>Added by admin</Pill>}
                    {!r.is_active && !r.reviewed && <Pill tone="amber">Waiting approval</Pill>}
                    {r.is_featured && <Pill tone="violet">Pinned</Pill>}
                  </div>
                  {r.content && <p className="text-sm text-slate-600 mt-1 line-clamp-3">{r.content}</p>}
                  <p className="text-[11px] text-slate-400 mt-1">
                    {timeAgo(r.created_at)}{r.product_id && productName[r.product_id] ? ` · ${productName[r.product_id]}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Live</span>
                    <Switch checked={r.is_active} onChange={(v) => flag(r, { is_active: v }, v ? 'Review is live' : 'Review hidden')} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Pin</span>
                    <Switch checked={r.is_featured} onChange={(v) => flag(r, { is_featured: v }, v ? 'Pinned to top' : 'Unpinned')} />
                  </div>
                  <button onClick={() => open(r)} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(r)} className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add review' : 'Edit review'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer name *"><input className={inputClass} value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} /></Field>
            <Field label="City (optional)"><input className={inputClass} value={form.author_location} onChange={(e) => setForm({ ...form, author_location: e.target.value })} /></Field>
          </div>
          <Field label="YouTube video (optional)" hint="Customer unboxing / review video. Shorts are shown vertically.">
            <input
              className={inputClass}
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value, is_short: isYouTubeShortUrl(e.target.value) || form.is_short })}
              placeholder="https://youtube.com/shorts/…"
            />
          </Field>
          {form.video_url && (
            vid ? (
              <div className="flex items-center gap-3">
                <img src={youTubeThumbnail(vid, 'mqdefault')} alt="" className={`rounded-lg object-cover ${form.is_short ? 'w-14 h-24' : 'w-28 h-16'}`} />
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={form.is_short} onChange={(e) => setForm({ ...form, is_short: e.target.checked })} className="accent-indigo-600" /> Vertical video
                </label>
              </div>
            ) : (
              <span className="text-xs text-red-600 font-semibold -mt-2">Not a valid YouTube link</span>
            )
          )}
          <Field label="Review text"><textarea rows={4} className={`${inputClass} resize-none`} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rating">
              <select className={inputClass} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
              </select>
            </Field>
            <Field label="About product (optional)" hint="Also shows on that product's page">
              <select className={inputClass} value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">— General —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Show on website" />
          <Toggle checked={form.is_featured} onChange={(v) => setForm({ ...form, is_featured: v })} label="Pin to the top" />
        </div>
      </Modal>
    </>
  );
}
