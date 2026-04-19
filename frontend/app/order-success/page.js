"use client";

import React, { Suspense } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ShoppingBag, Package } from 'lucide-react';
import { getOrder, normalizeOrder } from '../../lib/api';

const OrderSuccessContent = () => {
  const searchParams = useSearchParams();
  const [order, setOrder] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const idFromQuery = searchParams.get('id');
    if (!idFromQuery) {
      setLoaded(true);
      return;
    }
    // Fetch the real order from the backend API
    getOrder(idFromQuery)
      .then((raw) => setOrder(normalizeOrder(raw)))
      .catch(() => setOrder(null))
      .finally(() => setLoaded(true));
  }, [searchParams]);

  // ── Still loading ────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto gap-8 py-20">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Confirming your order...</p>
      </main>
    );
  }

  // ── Order not found ──────────────────────────────────────────────────────
  if (!order) {
    return (
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto gap-8 py-20">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
          <Package className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
          Order Not Found
        </h1>
        <p className="text-slate-500 max-w-sm">
          We couldn&apos;t retrieve your order details. Your order was still placed — check your email.
        </p>
        <Link
          href="/orders"
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
        >
          Track My Orders
        </Link>
      </main>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  return (
    <main className="flex-grow flex flex-col items-center justify-center p-5 text-center max-w-2xl mx-auto gap-8 py-14 md:py-20">
      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
            Order Placed!
          </h1>
          <p className="text-slate-500 text-sm md:text-base font-sans max-w-sm mx-auto">
            Thank you, <strong>{order.customer_name}</strong>! We&apos;ve received your order and will begin processing it shortly.
          </p>
        </div>
      </div>

      {/* Order summary card */}
      <div className="w-full bg-slate-50 border border-slate-100 rounded-[32px] p-8 md:p-10 flex flex-col gap-6 shadow-sm text-left">
        {/* Order ID */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order ID</span>
          <span className="text-base font-black text-blue-950 font-mono break-all">{order.id}</span>
        </div>

        <div className="h-px bg-slate-200 w-full" />

        {/* Key details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Paid</span>
            <span className="text-lg font-black text-blue-600">
              ₹{(order.total_amount ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Status</span>
            <span className="text-sm font-black text-orange-500 uppercase">
              {order.status ?? 'Pending'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Payment</span>
            <span className="text-[11px] font-bold text-slate-600 uppercase">
              {order.payment_status === 'verified'
                ? '✅ Verified'
                : order.payment_status === 'failed'
                  ? '❌ Payment failed'
                  : order.payment_status === 'received'
                    ? '🟡 Awaiting verification'
                    : '🟡 Payment pending'}
            </span>
          </div>
          {order.payment_id && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Txn ID</span>
              <span className="text-[11px] font-mono text-slate-600 break-all">{order.payment_id}</span>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-200 w-full" />

        {/* Items preview */}
        {order.items?.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Items</span>
            {order.items.slice(0, 3).map((item, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <span className="font-bold text-blue-950 truncate pr-4">{item.name} × {item.quantity}</span>
                <span className="font-black text-slate-500 whitespace-nowrap">
                  ₹{((item.price ?? 0) * item.quantity).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <span className="text-[10px] text-slate-400">+{order.items.length - 3} more items</span>
            )}
          </div>
        )}

        <button
          onClick={() => window.print()}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Save as PDF
        </button>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          href={`/orders/${order.id}`}
          className="w-full bg-white border-2 border-slate-100 text-blue-950 py-4 rounded-full font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" />
          Track This Order
        </Link>
        <Link
          href="/shop"
          className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-colors flex items-center justify-center gap-1"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Continue Shopping
        </Link>
      </div>
    </main>
  );
};

const OrderSuccessPage = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      <Navbar />
      <Suspense
        fallback={
          <main className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto gap-8 py-20">
            <div className="animate-pulse flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-slate-100 rounded-full" />
              <div className="h-8 w-48 bg-slate-100 rounded-lg" />
              <div className="h-4 w-64 bg-slate-100 rounded-lg" />
            </div>
          </main>
        }
      >
        <OrderSuccessContent />
      </Suspense>
      <Footer />
    </div>
  );
};

export default OrderSuccessPage;
