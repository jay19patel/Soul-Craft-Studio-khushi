"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Star, PlayCircle, EyeOff } from 'lucide-react';
import { getAdminProducts, setAdminProductFlags, getCategories } from '../../../lib/api';
import { Card, PageHeader, Button, Spinner, EmptyState, Switch, Pill, inputClass, useToast, formatMoney } from '../../../components/admin/ui';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Live' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'featured', label: 'On homepage' },
  { key: 'low', label: 'Low / sold out' },
];

export default function AdminProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    Promise.all([getAdminProducts(), getCategories()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((err) => toast(err.message, 'error'));
  }, [toast]);

  const visible = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.variants[0]?.sku || '').toLowerCase().includes(q)) return false;
      if (category && p.category_id !== category) return false;
      if (filter === 'active') return p.is_active;
      if (filter === 'disabled') return !p.is_active;
      if (filter === 'featured') return p.is_featured;
      if (filter === 'low') return p.stock <= 3;
      return true;
    });
  }, [products, search, filter, category]);

  const update = async (product, flags, message) => {
    setSavingId(product.id);
    try {
      const updated = await setAdminProductFlags(product.id, flags);
      setProducts((list) => list.map((p) => (p.id === product.id ? updated : p)));
      toast(message);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const editStock = (product) => {
    const value = window.prompt(`Stock for "${product.name}"`, String(product.stock));
    if (value === null) return;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return toast('Enter a whole number (0 or more).', 'error');
    update(product, { stock: n }, `Stock updated to ${n}`);
  };

  if (!products) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${products.length} products · ${products.filter((p) => p.is_active).length} live · ${products.filter((p) => p.is_featured).length} on homepage`}
        actions={
          <Link href="/admin/products/new">
            <Button><Plus className="w-4 h-4" /> Add product</Button>
          </Link>
        }
      />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border ${filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU" className={`${inputClass} pl-9`} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Card padded={false}>
        {visible.length === 0 ? (
          <EmptyState
            title="No products match"
            action={<Link href="/admin/products/new" className="text-sm font-bold text-indigo-600">Add a product</Link>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((p) => (
              <li key={p.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 md:px-6 py-3.5 ${!p.is_active ? 'bg-slate-50/70' : ''}`}>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {p.image && <img src={p.image} alt="" className={`w-full h-full object-cover ${!p.is_active ? 'opacity-50' : ''}`} />}
                    {!p.is_active && <EyeOff className="absolute inset-0 m-auto w-5 h-5 text-slate-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{p.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-sm font-black text-slate-800">{formatMoney(p.salePrice)}</span>
                      {p.discount > 0 && <Pill tone="amber">{p.discount}% off</Pill>}
                      {p.category && <Pill>{p.category.name}</Pill>}
                      {p.videos.length > 0 && <Pill tone="violet"><PlayCircle className="w-3 h-3" /> {p.videos.length}</Pill>}
                      {!p.is_active && <Pill tone="red">Disabled</Pill>}
                    </div>
                  </div>
                </Link>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pl-[68px] sm:pl-0">
                  <button onClick={() => editStock(p)} disabled={savingId === p.id} className="text-left sm:text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">Stock</span>
                    <span className={`text-sm font-black underline decoration-dotted ${p.stock === 0 ? 'text-red-600' : p.stock <= 3 ? 'text-amber-600' : 'text-slate-800'}`}>{p.stock}</span>
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><Star className="w-3 h-3" /> Home</span>
                    <Switch
                      checked={p.is_featured}
                      disabled={savingId === p.id}
                      title="Show as a brand section on the homepage"
                      onChange={(v) => update(p, { is_featured: v }, v ? 'Added to homepage' : 'Removed from homepage')}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Live</span>
                    <Switch
                      checked={p.is_active}
                      disabled={savingId === p.id}
                      title="Visible & purchasable in the store"
                      onChange={(v) => update(p, { is_active: v }, v ? 'Product is live' : 'Product disabled — hidden from the store')}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
