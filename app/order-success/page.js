"use client";

import React, { Suspense } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ShoppingBag, Share2, CheckCircle2, MapPin } from 'lucide-react';

const OrderSuccessContent = () => {
  const searchParams = useSearchParams();
  const [order, setOrder] = React.useState(null);

  React.useEffect(() => {
    const idFromQuery = searchParams.get('id');
    if (idFromQuery) {
      const existingOrders = JSON.parse(localStorage.getItem('soulcraft_orders') || '[]');
      const foundOrder = existingOrders.find(o => o.id === idFromQuery);
      if (foundOrder) {
        setOrder(foundOrder);
      }
    }
  }, [searchParams]);

  if (!order) {
    return (
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto gap-8 py-20">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Finding your order...</p>
      </main>
    );
  }

  return (
    <main className="flex-grow flex flex-col items-center justify-center p-5 text-center max-w-2xl mx-auto gap-8 py-14 md:py-20">
      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
            Order Received.
          </h1>
          <p className="text-slate-500 text-sm md:text-base font-sans max-w-sm mx-auto">
            Thank you for your purchase. We've received your order and will begin processing it shortly.
          </p>
        </div>
      </div>

      <div className="w-full bg-slate-50 border border-slate-100 rounded-[32px] p-8 md:p-10 flex flex-col gap-8 shadow-sm">
        {/* Simplified Order & Payment Info */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order ID (Receipt ID)</span>
            <span className="text-xl font-black text-blue-950 uppercase">#{order.id}</span>
          </div>
          
          <div className="flex justify-center gap-12 pt-2 pb-2">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Payment ID</span>
              <span className="text-[11px] font-bold text-blue-600 uppercase">{order.paymentId || 'Pending'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Status</span>
              <span className="text-[10px] font-black uppercase text-orange-500 px-3 py-1 bg-orange-50 rounded-full border border-orange-100">
                {order.paymentStatus}
              </span>
            </div>
          </div>

          <div className="h-px bg-slate-200 w-full" />

          <button 
            onClick={() => window.print()}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Receipt
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link href={`/orders/${order.id}`} className="w-full bg-white border-2 border-slate-100 text-blue-950 py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm hover:bg-slate-50 transition-all flex items-center justify-center">
          View My Order
        </Link>
        <Link href="/shop" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-colors">
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
      <Suspense fallback={
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto gap-8 py-20">
          <div className="animate-pulse flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-slate-100 rounded-full" />
            <div className="h-8 w-48 bg-slate-100 rounded-lg" />
            <div className="h-4 w-64 bg-slate-100 rounded-lg" />
          </div>
        </main>
      }>
        <OrderSuccessContent />
      </Suspense>
      <Footer />
    </div>
  );
};

export default OrderSuccessPage;
