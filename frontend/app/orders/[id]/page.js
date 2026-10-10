"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Package, Truck, CheckCircle, Clock, X, MapPin, CreditCard, Download, Loader2, Hammer, ShieldCheck, ExternalLink,
} from 'lucide-react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { StatusBadge, PaymentBadge } from '../../../components/OrderStatusBadges';
import { getOrder, cancelMyOrder } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PAYMENT_METHOD_LABEL } from '../../../lib/constants';

const STEPS = [
  { key: 'PENDING', label: 'Order placed', icon: Package, field: 'created_at' },
  { key: 'CONFIRMED', label: 'Confirmed', icon: ShieldCheck, field: 'confirmed_at' },
  { key: 'PROCESSING', label: 'Being crafted', icon: Hammer, field: 'processing_at' },
  { key: 'SHIPPED', label: 'Shipped', icon: Truck, field: 'shipped_at' },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle, field: 'delivered_at' },
];

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function OrderDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setOrder(await getOrder(id));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?redirect=/orders/${id}`);
      return;
    }
    load();
  }, [authLoading, isAuthenticated, id, load, router]);

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    setBusy('cancel');
    try {
      setOrder(await cancelMyOrder(id, 'Cancelled by customer'));
      setMessage('Your order has been cancelled.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  };

  if (loading || authLoading) {
    return (
      <main className="flex-grow flex items-center justify-center py-32">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="flex-grow flex flex-col items-center justify-center gap-6 text-center px-4 py-24">
        <Package className="w-14 h-14 text-slate-300" />
        <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Order not found</h1>
        <p className="text-slate-500 max-w-sm">{error || 'This order does not exist.'}</p>
        <Link href="/orders" className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm">My orders</Link>
      </main>
    );
  }

  const cancelled = order.status === 'CANCELLED';
  const currentIdx = STEPS.findIndex((s) => s.key === order.status);
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status) && order.payment_status !== 'VERIFIED';
  const tracking = order.tracking || {};

  return (
    <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-6 md:py-14">
      <Link href="/orders" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500 mb-5">
        <ChevronLeft className="w-4 h-4" /> My orders
      </Link>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">{order.order_number}</h1>
          <p className="text-sm text-slate-500 mt-1">Placed {fmt(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.payment_status} method={order.payment_method} />
          <a
            href={`/orders/${order.id}/invoice`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-950 text-white text-[11px] font-black uppercase tracking-widest"
          >
            <Download className="w-3.5 h-3.5" /> Invoice
          </a>
        </div>
      </div>

      {message && <div className="mb-5 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900 text-sm font-semibold p-4">{message}</div>}

      {order.payment_method === 'UPI' && order.payment_status === 'RECEIVED' && !cancelled && (
        <div className="mb-6 rounded-3xl bg-blue-50 border border-blue-100 p-5 text-sm text-blue-900">
          <strong>We are verifying your UPI payment</strong> (UTR {order.upi_transaction_id}). You will get an email as soon as it is confirmed.
        </div>
      )}

      {order.payment_status === 'FAILED' && order.payment_method === 'UPI' && !cancelled && (
        <div className="mb-6 rounded-3xl bg-red-50 border border-red-100 p-5 text-sm text-red-800">
          We could not find this UPI payment. Please <Link href="/contact" className="underline font-bold">contact us</Link> with your payment screenshot.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 flex flex-col gap-5">
          {/* Progress */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-7">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-950 mb-5">Order tracking</h2>
            {cancelled ? (
              <div className="flex items-start gap-4">
                <span className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0"><X className="w-4 h-4" /></span>
                <div>
                  <p className="font-black text-red-700">Cancelled</p>
                  <p className="text-sm text-slate-500">{order.cancel_reason} · {fmt(order.cancelled_at)}</p>
                  {order.payment_status === 'VERIFIED' && <p className="text-sm text-slate-600 mt-1">Your refund will be processed to the original payment method.</p>}
                </div>
              </div>
            ) : (
              <ol className="relative flex flex-col gap-0">
                {STEPS.map((step, idx) => {
                  const done = idx <= currentIdx;
                  const Icon = step.icon;
                  return (
                    <li key={step.key} className="flex gap-4 relative pb-6 last:pb-0">
                      {idx < STEPS.length - 1 && <span className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-100'}`} />}
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="pt-1.5">
                        <p className={`text-sm font-black uppercase tracking-wider ${done ? 'text-blue-950' : 'text-slate-400'}`}>{step.label}</p>
                        {order[step.field] && done && <p className="text-xs text-slate-500">{fmt(order[step.field])}</p>}
                        {step.key === 'SHIPPED' && done && (tracking.courier || tracking.tracking_number) && (
                          <div className="mt-2 text-xs bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-violet-900">
                            {tracking.courier && <span className="font-bold">{tracking.courier}</span>}
                            {tracking.tracking_number && <span> · {tracking.tracking_number}</span>}
                            {tracking.tracking_url && (
                              <a href={tracking.tracking_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-bold underline mt-1">
                                Track shipment <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Items */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-7">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-950 mb-5">Items</h2>
            <ul className="flex flex-col gap-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                    {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 m-5 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.product_id ? (
                      <Link href={`/shop/${item.product_id}`} className="text-sm font-bold text-blue-950 line-clamp-2 hover:text-orange-600">{item.name}</Link>
                    ) : (
                      <p className="text-sm font-bold text-blue-950">{item.name}</p>
                    )}
                    <p className="text-xs text-slate-500">Qty {item.quantity} × ₹{item.price.toLocaleString('en-IN')}</p>
                  </div>
                  <span className="text-sm font-black text-blue-950">₹{item.line_total.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 mt-5 pt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-bold">₹{order.subtotal.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-bold">{order.shipping_fee ? `₹${order.shipping_fee}` : 'Free'}</span></div>
              {order.cod_fee > 0 && <div className="flex justify-between"><span className="text-slate-500">COD charge</span><span className="font-bold">₹{order.cod_fee}</span></div>}
              <div className="flex justify-between text-base pt-2 border-t border-slate-100"><span className="font-black text-blue-950">Total</span><span className="font-black text-orange-600">₹{order.total_amount.toLocaleString('en-IN')}</span></div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery address</h2>
            <p className="text-sm leading-relaxed text-slate-700">
              <span className="font-bold text-blue-950">{order.customer_name}</span><br />
              {order.shipping_address}<br />
              {order.customer_phone && <>📞 {order.customer_phone}</>}
            </p>
          </section>

          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment</h2>
            <p className="text-sm font-bold text-blue-950">{PAYMENT_METHOD_LABEL[order.payment_method]}</p>
            <PaymentBadge status={order.payment_status} method={order.payment_method} className="w-fit" />
            {order.upi_transaction_id && <p className="text-xs text-slate-500 break-all">UTR: {order.upi_transaction_id}</p>}
          </section>

          {order.customer_note && (
            <section className="bg-orange-50 rounded-3xl border border-orange-100 p-5">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-orange-600 mb-1">Your note</h2>
              <p className="text-sm text-orange-900">{order.customer_note}</p>
            </section>
          )}

          {canCancel && (
            <button onClick={cancel} disabled={!!busy} className="w-full py-3.5 rounded-full border-2 border-red-100 text-red-500 font-black uppercase tracking-widest text-xs hover:bg-red-50 disabled:opacity-50">
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}

          <Link href="/contact" className="text-center text-xs font-bold text-slate-500 hover:text-orange-600">
            <Clock className="w-3.5 h-3.5 inline mr-1" /> Need help with this order? Contact us
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />
      <Suspense fallback={<main className="flex-grow" />}>
        <OrderDetail />
      </Suspense>
      <Footer />
    </div>
  );
}
