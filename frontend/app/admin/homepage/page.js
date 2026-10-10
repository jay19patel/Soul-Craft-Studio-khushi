"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, PlayCircle, ExternalLink, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { getAdminSettings, saveAdminSettings, getAdminProducts, setAdminProductFlags } from '../../../lib/api';
import { getYouTubeId, isYouTubeShortUrl, youTubeThumbnail } from '../../../lib/youtube';
import { Card, PageHeader, Button, Field, Toggle, Spinner, Switch, inputClass, useToast } from '../../../components/admin/ui';

export default function AdminHomepagePage() {
  const toast = useToast();
  const [home, setHome] = useState(null);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingFeatured, setSavingFeatured] = useState(null);

  useEffect(() => {
    Promise.all([getAdminSettings(), getAdminProducts()])
      .then(([s, p]) => {
        setHome({ ...s.settings.home, brand_videos: s.settings.home.brand_videos || [] });
        setProducts(p);
      })
      .catch((err) => toast(err.message, 'error'));
  }, [toast]);

  if (!home) return <Spinner />;

  const set = (k, v) => setHome((h) => ({ ...h, [k]: v }));
  const setVideo = (i, patch) =>
    set('brand_videos', home.brand_videos.map((v, idx) => {
      if (idx !== i) return v;
      const next = { ...v, ...patch };
      if (patch.url !== undefined && isYouTubeShortUrl(patch.url)) next.is_short = true;
      return next;
    }));

  const save = async () => {
    const bad = home.brand_videos.find((v) => v.url && !getYouTubeId(v.url));
    if (bad) return toast(`"${bad.url}" is not a valid YouTube link.`, 'error');
    if (home.hero_video_url && !getYouTubeId(home.hero_video_url)) return toast('Hero video must be a YouTube link.', 'error');
    setSaving(true);
    try {
      const saved = await saveAdminSettings('home', { ...home, brand_videos: home.brand_videos.filter((v) => v.url) });
      setHome({ ...saved.home });
      toast('Homepage updated — live now');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const featured = products.filter((p) => p.is_featured).sort((a, b) => a.featured_order - b.featured_order);

  const toggleFeatured = async (p, value) => {
    setSavingFeatured(p.id);
    try {
      const updated = await setAdminProductFlags(p.id, { is_featured: value });
      setProducts((list) => list.map((x) => (x.id === p.id ? updated : x)));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingFeatured(null);
    }
  };

  const moveFeatured = async (idx, dir) => {
    const order = [...featured];
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    // Persist the new order as 10, 20, 30… so there is room for manual numbers too.
    setSavingFeatured('order');
    try {
      const updated = await Promise.all(order.map((p, i) => setAdminProductFlags(p.id, { featured_order: (i + 1) * 10 })));
      setProducts((list) => list.map((x) => updated.find((u) => u.id === x.id) || x));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingFeatured(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Homepage & videos"
        subtitle="Everything on the homepage, without touching code"
        actions={
          <>
            <Link href="/" target="_blank"><Button variant="secondary"><ExternalLink className="w-4 h-4" /> Preview</Button></Link>
            <Button onClick={save} loading={saving}>Save changes</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Hero (top of the page)">
          <div className="flex flex-col gap-4">
            <Field label="Announcement bar" hint="Thin strip above the menu on every page. Leave empty to hide.">
              <input className={inputClass} maxLength={140} value={home.announcement} onChange={(e) => set('announcement', e.target.value)} placeholder="🎁 Free shipping above ₹999 · Diwali orders open" />
            </Field>
            <Field label="Small badge"><input className={inputClass} maxLength={60} value={home.hero_badge} onChange={(e) => set('hero_badge', e.target.value)} /></Field>
            <Field label="Headline *" hint="The last word is highlighted in orange."><input className={inputClass} maxLength={80} value={home.hero_title} onChange={(e) => set('hero_title', e.target.value)} /></Field>
            <Field label="Sub-headline"><textarea rows={3} className={`${inputClass} resize-none`} maxLength={300} value={home.hero_subtitle} onChange={(e) => set('hero_subtitle', e.target.value)} /></Field>
            <Field label="Button text"><input className={inputClass} maxLength={30} value={home.hero_cta_label} onChange={(e) => set('hero_cta_label', e.target.value)} /></Field>
            <Field label="Hero video (optional YouTube link)" hint="If set, the video replaces the photo collage in the hero.">
              <input className={inputClass} value={home.hero_video_url} onChange={(e) => set('hero_video_url', e.target.value)} placeholder="https://youtu.be/…" />
            </Field>
          </div>
        </Card>

        <Card title="Sections">
          <Toggle checked={home.show_categories} onChange={(v) => set('show_categories', v)} label="Show categories" />
          <Toggle checked={home.show_new_arrivals} onChange={(v) => set('show_new_arrivals', v)} label="Show new arrivals grid" />
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Video section title"><input className={inputClass} maxLength={80} value={home.story_title} onChange={(e) => set('story_title', e.target.value)} /></Field>
            <Field label="Video section subtitle"><input className={inputClass} maxLength={200} value={home.story_subtitle} onChange={(e) => set('story_subtitle', e.target.value)} /></Field>
          </div>
        </Card>

        <Card title={`Brand videos (${home.brand_videos.length}/8)`} className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {home.brand_videos.map((v, i) => {
              const vid = getYouTubeId(v.url);
              return (
                <div key={i} className="flex gap-3 items-start bg-slate-50 rounded-2xl p-3">
                  <div className={`shrink-0 rounded-lg overflow-hidden bg-slate-200 ${v.is_short ? 'w-14 h-24' : 'w-28 h-16'}`}>
                    {vid ? <img src={youTubeThumbnail(vid, 'mqdefault')} alt="" className="w-full h-full object-cover" /> : <PlayCircle className="w-6 h-6 m-auto mt-5 text-slate-400" />}
                  </div>
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <input className={inputClass} value={v.url} onChange={(e) => setVideo(i, { url: e.target.value })} placeholder="YouTube link" />
                    {v.url && !vid && <span className="text-[11px] text-red-600 font-semibold">Not a valid YouTube link</span>}
                    <input className={inputClass} value={v.title} maxLength={120} onChange={(e) => setVideo(i, { title: e.target.value })} placeholder="Title (optional)" />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={!!v.is_short} onChange={(e) => setVideo(i, { is_short: e.target.checked })} className="accent-indigo-600" /> Vertical (Short / reel)
                    </label>
                  </div>
                  <button onClick={() => set('brand_videos', home.brand_videos.filter((_, idx) => idx !== i))} className="p-2 rounded-xl text-slate-400 hover:text-red-600" aria-label="Remove video">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          {home.brand_videos.length < 8 && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => set('brand_videos', [...home.brand_videos, { url: '', title: '', is_short: false }])}>
              <Plus className="w-4 h-4" /> Add video
            </Button>
          )}
          <p className="text-[11px] text-slate-400 mt-3">Studio tour, making-of, packing orders… These appear in the “Behind the craft” section. Customer video reviews are managed under Reviews.</p>
        </Card>

        <Card title="Featured products (brand sections)" className="lg:col-span-2">
          <p className="text-sm text-slate-500 mb-4">
            Each featured product gets a full-width section with its photos, tagline, highlights, price and first video. Edit content in the product editor.
            {featured.length === 0 && ' None selected yet — the 3 newest products are shown automatically.'}
          </p>
          <ul className="flex flex-col gap-2 mb-5">
            {featured.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 bg-indigo-50/60 rounded-2xl p-2.5">
                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}</div>
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/products/${p.id}`} className="font-bold text-sm text-slate-900 truncate block hover:text-indigo-600">{i + 1}. {p.name}</Link>
                  <p className="text-[11px] text-slate-500">{p.videos.length} video{p.videos.length === 1 ? '' : 's'} · {p.highlights.length} highlights{!p.is_active && ' · ⚠ disabled'}</p>
                </div>
                <button onClick={() => moveFeatured(i, -1)} disabled={i === 0 || !!savingFeatured} className="p-2 rounded-lg hover:bg-white disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => moveFeatured(i, 1)} disabled={i === featured.length - 1 || !!savingFeatured} className="p-2 rounded-lg hover:bg-white disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                <Switch checked onChange={() => toggleFeatured(p, false)} disabled={!!savingFeatured} title="Remove from homepage" />
              </li>
            ))}
          </ul>
          <details className="group">
            <summary className="cursor-pointer text-sm font-bold text-indigo-600 flex items-center gap-1"><Star className="w-4 h-4" /> Add products to homepage</summary>
            <ul className="mt-3 flex flex-col divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {products.filter((p) => !p.is_featured).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}</div>
                  <span className="flex-1 text-sm truncate">{p.name}{!p.is_active && <span className="text-slate-400"> (disabled)</span>}</span>
                  <Switch checked={false} onChange={() => toggleFeatured(p, true)} disabled={savingFeatured === p.id} title="Show on homepage" />
                </li>
              ))}
            </ul>
          </details>
        </Card>
      </div>

      <div className="md:hidden fixed bottom-[58px] inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3">
        <Button size="lg" className="w-full" onClick={save} loading={saving}>Save homepage</Button>
      </div>
    </>
  );
}
