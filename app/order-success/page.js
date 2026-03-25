"use client";

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ShoppingBag, Share2, CheckCircle2 } from 'lucide-react';

const OrderSuccessPage = () => {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = React.useState(null);

  React.useEffect(() => {
    const idFromQuery = searchParams.get('id');
    if (idFromQuery) {
      setOrderId(idFromQuery);
    } else {
      setOrderId(`SC-${Math.floor(Math.random() * 1000000)}`);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      <Navbar />

      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto gap-8 py-20">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
              Order Received.
            </h1>
            <p className="text-slate-500 text-base md:text-lg font-sans max-w-md mx-auto">
              Thank you for your purchase. We've received your order and will begin processing it shortly.
            </p>
          </div>
        </div>

        <div className="w-full bg-slate-50 border border-slate-100 rounded-[32px] p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order Reference</span>
            <span className="text-lg font-black text-blue-950">#{orderId || '......'}</span>
          </div>
          
          <div className="h-px bg-slate-200 w-full" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
              <div className="w-10 h-10 bg-pink-50 rounded-full flex items-center justify-center text-pink-500">
                <Share2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-950">Stay Connected</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Follow for updates</span>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-950">Shipping Info</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Tracking soon</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full pt-4">
          <Link href="/shop" className="flex-grow bg-blue-600 text-white py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group">
            Continue Shopping
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href={`/orders/${orderId}`} className="flex-grow bg-white border-2 border-slate-100 text-blue-950 py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm hover:bg-slate-50 transition-all flex items-center justify-center">
            View My Order
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderSuccessPage;
