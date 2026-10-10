"use client";

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, ShieldCheck } from 'lucide-react';
import { getAdminUsers, setAdminUserActive, getAdminCarts } from '../../../lib/api';
import { Card, PageHeader, Spinner, EmptyState, Switch, Pill, inputClass, useToast, formatMoney, timeAgo } from '../../../components/admin/ui';

function Customers() {
  const toast = useToast();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'carts' ? 'carts' : 'customers');
  const [users, setUsers] = useState(null);
  const [carts, setCarts] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAdminUsers().then(setUsers).catch((err) => toast(err.message, 'error'));
    getAdminCarts().then(setCarts).catch(() => setCarts([]));
  }, [toast]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users || []).filter((u) => !q || u.email.toLowerCase().includes(q) || u.first_name.toLowerCase().includes(q));
  }, [users, search]);

  const setActive = async (u, active) => {
    if (!active && !window.confirm(`Disable ${u.email}? They will be logged out and cannot sign in.`)) return;
    try {
      await setAdminUserActive(u.id, active);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, is_active: active } : x)));
      toast(active ? 'Account enabled' : 'Account disabled');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!users) return <Spinner />;

  return (
    <>
      <PageHeader title="Customers" subtitle={`${users.length} accounts · ${(carts || []).length} active carts`} />
      <div className="flex gap-2 mb-4">
        {[['customers', 'Customers'], ['carts', `Active carts (${(carts || []).length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-sm font-bold border ${tab === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
        ))}
      </div>

      {tab === 'customers' ? (
        <>
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className={`${inputClass} pl-9`} />
          </div>
          <Card padded={false}>
            {visible.length === 0 ? <EmptyState title="No customers found" /> : (
              <ul className="divide-y divide-slate-100">
                {visible.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-4 md:px-6 py-3">
                    <span className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 font-black flex items-center justify-center shrink-0">
                      {(u.first_name || u.email)[0]?.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">{u.first_name || '—'}</span>
                        {u.is_superuser && <Pill tone="indigo"><ShieldCheck className="w-3 h-3" /> Admin</Pill>}
                        {!u.is_active && <Pill tone="red">Disabled</Pill>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      <p className="text-[11px] text-slate-400">Joined {timeAgo(u.date_joined)} · last login {u.last_login ? timeAgo(u.last_login) : 'never'}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-black text-slate-900">{formatMoney(u.spent)}</p>
                      <p className="text-[11px] text-slate-400">{u.orders} orders</p>
                    </div>
                    {!u.is_superuser && <Switch checked={u.is_active} onChange={(v) => setActive(u, v)} title="Account enabled" />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <Card padded={false}>
          {!carts ? <Spinner /> : carts.length === 0 ? <EmptyState title="No active carts" text="Carts with items that haven't been ordered yet will show here." /> : (
            <ul className="divide-y divide-slate-100">
              {carts.map((c) => (
                <li key={c.id} className="px-4 md:px-6 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{c.user.full_name}</p>
                      <a href={`mailto:${c.user.email}`} className="text-xs text-indigo-600 truncate block">{c.user.email}</a>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">{formatMoney(c.total)}</p>
                      <p className="text-[11px] text-slate-400">{timeAgo(c.updated_at)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">{c.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Customers />
    </Suspense>
  );
}
