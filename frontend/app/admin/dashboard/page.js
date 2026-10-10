"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Banknote, ShoppingBag, Clock, Package, ShoppingCart, Mail, AlertTriangle, BadgeCheck, Truck, Star, Send, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react';
import { getAdminStats, getAdminAlerts } from '../../../lib/api';
import { Card, PageHeader, Button, Spinner, formatMoney, timeAgo } from '../../../components/admin/ui';
import { StatusBadge, PaymentBadge } from '../../../components/OrderStatusBadges';

const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '1m', label: '30 days' },
  { key: '1y', label: '12 months' },
  { key: 'all', label: 'All time' },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (r = range) => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([getAdminStats(r), getAdminAlerts()]);
      setStats(s);
      setAlerts(a);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load('7d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRange = async (r) => {
    setRange(r);
    try {
      setStats(await getAdminStats(r));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && !stats) return <Spinner />;

  const actionItems = alerts
    ? [
        { count: alerts.payments_to_verify, label: 'UPI payments to verify', href: '/admin/orders?payment_status=RECEIVED', icon: BadgeCheck, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
        { count: alerts.orders_to_ship, label: 'Orders to craft & ship', href: '/admin/orders?status=CONFIRMED', icon: Truck, tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
        { count: alerts.needs_attention, label: 'Orders need attention', href: '/admin/orders?attention=1', icon: AlertTriangle, tone: 'bg-red-50 text-red-700 border-red-100' },
        { count: alerts.pending_reviews, label: 'Reviews to approve', href: '/admin/reviews', icon: Star, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
        { count: alerts.unread_messages, label: 'Unread messages', href: '/admin/messages', icon: Mail, tone: 'bg-violet-50 text-violet-700 border-violet-100' },
        { count: alerts.failed_emails, label: 'Failed emails (7 days)', href: '/admin/emails?status=FAILED', icon: Send, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
      ].filter((a) => a.count > 0)
    : [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="What needs your attention today"
        actions={<Button variant="secondary" onClick={() => load(range)} loading={loading}><RefreshCw className="w-4 h-4" /> Refresh</Button>}
      />

      {error && <div className="mb-5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold p-3">{error}</div>}

      {/* To-do */}
      {alerts && (
        actionItems.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {actionItems.map(({ count, label, href, icon: Icon, tone }) => (
              <Link key={label} href={href} className={`flex items-center gap-3 rounded-2xl border p-4 hover:shadow-md transition-all ${tone}`}>
                <Icon className="w-6 h-6 shrink-0" />
                <span className="text-2xl font-black">{count}</span>
                <span className="text-sm font-semibold leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-800 p-4 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> All caught up — nothing waiting for you.
          </div>
        )
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <Stat icon={Banknote} label="Paid revenue" value={formatMoney(stats.total_revenue)} className="col-span-2" accent="text-emerald-600 bg-emerald-50" />
          <Stat icon={ShoppingBag} label="Total orders" value={stats.total_orders} accent="text-blue-600 bg-blue-50" />
          <Stat icon={Clock} label="Open orders" value={stats.pending_orders} accent="text-orange-600 bg-orange-50" />
          <Stat icon={Package} label="Products" value={stats.total_products} accent="text-indigo-600 bg-indigo-50" href="/admin/products" />
          <Stat icon={ShoppingCart} label="Active carts" value={stats.active_carts} accent="text-amber-600 bg-amber-50" href="/admin/customers?tab=carts" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2" title="Sales" actions={
          <div className="flex bg-slate-100 rounded-xl p-1 text-[11px] font-bold">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => changeRange(r.key)} className={`px-2.5 py-1.5 rounded-lg ${range === r.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                {r.label}
              </button>
            ))}
          </div>
        }>
          <div className="h-64 md:h-72 -ml-4 md:ml-0">
            {stats?.daily_stats && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.daily_stats} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} />
                  <YAxis yAxisId="right" orientation="right" hide />
                  <Tooltip
                    formatter={(value, name) => (name === 'Paid revenue' ? formatMoney(value) : value)}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#fdba74" radius={[4, 4, 0, 0]} barSize={14} />
                  <Area yAxisId="left" type="monotone" dataKey="sales" name="Paid revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#salesFill)" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Line = revenue from paid orders · Bars = number of orders (excluding cancelled)</p>
        </Card>

        <Card title="Store setup">
          {alerts && (
            <ul className="flex flex-col gap-3 text-sm">
              <SetupRow ok={alerts.integrations.upi_id} label="UPI payments (QR)" hint="Add your UPI ID in Settings → Payments" />
              <SetupRow ok={alerts.integrations.cod} label="Cash on delivery" hint="Optional — Settings → Payments" />
              <SetupRow ok={alerts.integrations.smtp} label="Email sending (SMTP)" hint="Add SMTP_* env variables" />
            </ul>
          )}
          <Link href="/admin/settings" className="mt-4 inline-block text-xs font-bold text-indigo-600">Open settings →</Link>
        </Card>

        <Card className="lg:col-span-2" title="Recent orders" actions={<Link href="/admin/orders" className="text-xs font-bold text-indigo-600">View all</Link>} padded={false}>
          <ul className="divide-y divide-slate-100">
            {(alerts?.recent_orders || []).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-4 md:px-6 py-3 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{o.order_number} · {o.customer_name}</p>
                    <p className="text-xs text-slate-500">{timeAgo(o.created_at)} · {formatMoney(o.total_amount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={o.status} />
                    <PaymentBadge status={o.payment_status} method={o.payment_method} />
                  </div>
                </Link>
              </li>
            ))}
            {alerts && !alerts.recent_orders.length && <li className="px-6 py-8 text-sm text-slate-500 text-center">No orders yet.</li>}
          </ul>
        </Card>

        <Card title={`Low stock (≤ ${alerts?.low_stock_threshold ?? 3})`} padded={false}>
          <ul className="divide-y divide-slate-100">
            {(alerts?.low_stock || []).map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-4 md:px-6 py-3 hover:bg-slate-50">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                    {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{p.name}</span>
                  <span className={`text-xs font-black ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>{p.stock === 0 ? 'Sold out' : `${p.stock} left`}</span>
                </Link>
              </li>
            ))}
            {alerts && !alerts.low_stock.length && <li className="px-6 py-8 text-sm text-slate-500 text-center">Stock levels look healthy.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, accent, className = '', href }) {
  const body = (
    <div className={`bg-white rounded-2xl border border-slate-200/70 p-4 flex flex-col gap-3 h-full ${href ? 'hover:shadow-md transition-all' : ''}`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xl md:text-2xl font-black text-slate-900">{value}</span>
      </span>
    </div>
  );
  return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

function SetupRow({ ok, label, hint }) {
  return (
    <li className="flex items-start gap-2.5">
      {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-slate-300 shrink-0" />}
      <span className="flex flex-col">
        <span className="font-semibold text-slate-800">{label}</span>
        {!ok && <span className="text-xs text-slate-500">{hint}</span>}
      </span>
    </li>
  );
}
