"use client";

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ShoppingBag, Package, Clock, Download } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getOrder } from '../../lib/api';
import { PAYMENT_METHOD_LABEL } from '../../lib/constants';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [order, setOrder] = useState(null);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!id) return;
    getOrder(id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) {
    return (
      <main className="flex-grow flex flex-col items-center justify-center gap-4 py-24">
        <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Confirming your order…</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center gap-6 py-24">
        <Package className="w-14 h-14 text-slate-300" />
        <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Order not found</h1>
        <p className="text-slate-500 max-w-sm">Check “My orders” for the latest status of your purchase.</p>
        <Link href="/orders" className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm">My orders</Link>
      </main>
    );
  }

  const paid = order.payment_status === 'VERIFIED';
  const verifying = order.payment_method === 'UPI' && order.payment_status === 'RECEIVED';
  const cod = order.payment_method === 'COD';

  return (
    <main className="flex-grow w-full max-w-xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center gap-8 text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${paid || cod ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
        {paid || cod ? <CheckCircle2 className="w-10 h-10" /> : <Clock className="w-10 h-10" />}
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
          {paid ? 'Order confirmed!' : 'Order placed!'}
        </h1>
        <p className="text-slate-600">
          Thank you, <strong>{order.customer_name}</strong>!{' '}
          {paid && 'Your payment is received and we have started on your order.'}
          {verifying && 'We are verifying your UPI payment and will email you as soon as it is confirmed.'}
          {cod && 'Please keep the amount ready when your order arrives.'}
        </p>
        <p className="text-xs text-slate-400">A confirmation has been sent to {order.customer_email}.</p>
      </div>

      <div className="w-full bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-4 text-left">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Order</span>
          <span className="font-black text-blue-950">{order.order_number}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Payment</span>
          <span className="text-sm font-bold text-slate-700">{PAYMENT_METHOD_LABEL[order.payment_method]}</span>
        </div>
        <div className="h-px bg-slate-100" />
        {order.items.slice(0, 4).map((item) => (
          <div key={item.id} className="flex justify-between text-sm gap-4">
            <span className="text-slate-700 truncate">{item.name} × {item.quantity}</span>
            <span className="font-bold">₹{item.line_total.toLocaleString('en-IN')}</span>
          </div>
        ))}
        {order.items.length > 4 && <span className="text-xs text-slate-400">+{order.items.length - 4} more</span>}
        <div className="h-px bg-slate-100" />
        <div className="flex justify-between items-center">
          <span className="font-black text-blue-950">Total</span>
          <span className="font-black text-xl text-orange-600">₹{order.total_amount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="w-full flex flex-col sm:flex-row gap-3">
        <Link href={`/orders/${order.id}`} className="flex-1 bg-orange-500 text-white py-4 rounded-full font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2">
          <Package className="w-4 h-4" /> Track order
        </Link>
        <a href={`/orders/${order.id}/invoice`} className="flex-1 bg-white border-2 border-slate-100 text-blue-950 py-4 rounded-full font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> Invoice
        </a>
      </div>
      <Link href="/shop" className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 flex items-center gap-1">
        <ShoppingBag className="w-3.5 h-3.5" /> Continue shopping
      </Link>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <Suspense fallback={<main className="flex-grow" />}>
        <OrderSuccessContent />
      </Suspense>
      <Footer />
    </div>
  );
}
