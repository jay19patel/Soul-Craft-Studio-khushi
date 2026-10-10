"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, AlertTriangle } from 'lucide-react';
import { getAdminOrders } from '../../../lib/api';
import { Card, PageHeader, Spinner, EmptyState, Pagination, inputClass, formatMoney, timeAgo } from '../../../components/admin/ui';
import { StatusBadge, PaymentBadge } from '../../../components/OrderStatusBadges';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_META } from '../../../lib/constants';

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'New' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PROCESSING', label: 'Crafting' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

function OrdersList() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') || '';
  const paymentStatus = params.get('payment_status') || '';
  const method = params.get('payment_method') || '';
  const attention = params.get('attention') === '1';
  const search = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(search);

  const setQuery = useCallback(
    (updates) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      if (!('page' in updates)) next.delete('page');
      router.replace(`/admin/orders${next.toString() ? `?${next}` : ''}`, { scroll: false });
    },
    [params, router]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminOrders({ page, page_size: PAGE_SIZE, status, payment_status: paymentStatus, payment_method: method, attention, search })
      .then((data) => {
        if (cancelled) return;
        setOrders(data.results);
        setTotal(data.total);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, status, paymentStatus, method, attention, search]);

  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => setQuery({ q: searchInput.trim() }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <>
      <PageHeader title="Orders" subtitle={`${total} order${total === 1 ? '' : 's'}${attention ? ' needing attention' : ''}`} />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 mb-4">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setQuery({ status: t.key, attention: '' })}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-colors ${
              status === t.key && !attention ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setQuery({ attention: attention ? '' : '1', status: '' })}
          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border inline-flex items-center gap-1.5 ${attention ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Attention
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <div className="relative col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Order no., name, email, phone, UTR…" className={`${inputClass} pl-9`} />
        </div>
        <select value={paymentStatus} onChange={(e) => setQuery({ payment_status: e.target.value })} className={inputClass}>
          <option value="">Any payment</option>
          {Object.entries(PAYMENT_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={method} onChange={(e) => setQuery({ payment_method: e.target.value })} className={inputClass}>
          <option value="">Any method</option>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 text-red-600 text-sm font-semibold p-3">{error}</div>}

      <Card padded={false}>
        {loading ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders found" text="Try a different filter or search." />
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-slate-100">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="block px-4 py-3.5 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm">{o.order_number}</p>
                        <p className="text-xs text-slate-500 truncate">{o.customer_name} · {timeAgo(o.created_at)}</p>
                      </div>
                      <span className="font-black text-slate-900 text-sm">{formatMoney(o.total_amount)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <StatusBadge status={o.status} />
                      <PaymentBadge status={o.payment_status} method={o.payment_method} />
                      {o.needs_attention && <span className="text-[10px] font-black text-red-600 uppercase">⚠ Attention</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-6 py-3 font-bold">Order</th>
                  <th className="px-3 py-3 font-bold">Customer</th>
                  <th className="px-3 py-3 font-bold">Items</th>
                  <th className="px-3 py-3 font-bold">Total</th>
                  <th className="px-3 py-3 font-bold">Payment</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    <td className="px-6 py-3.5">
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-slate-900 hover:text-indigo-600" onClick={(e) => e.stopPropagation()}>
                        {o.order_number}
                      </Link>
                      <p className="text-xs text-slate-400">{timeAgo(o.created_at)}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-semibold text-slate-800">{o.customer_name}</p>
                      <p className="text-xs text-slate-400">{o.customer_phone || o.customer_email}</p>
                    </td>
                    <td className="px-3 py-3.5 text-slate-600 max-w-[220px] truncate">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</td>
                    <td className="px-3 py-3.5 font-black text-slate-900">{formatMoney(o.total_amount)}</td>
                    <td className="px-3 py-3.5">
                      <PaymentBadge status={o.payment_status} method={o.payment_method} />
                      <p className="text-[11px] text-slate-400 mt-1">{PAYMENT_METHOD_LABEL[o.payment_method]}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={o.status} />
                      {o.needs_attention && <p className="text-[11px] font-bold text-red-600 mt-1">⚠ Needs attention</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="px-4 md:px-6 pb-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={(p) => setQuery({ page: String(p) })} />
        </div>
      </Card>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OrdersList />
    </Suspense>
  );
}
