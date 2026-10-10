"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ChevronRight, Loader2, ShoppingBag } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { StatusBadge, PaymentBadge } from '../../components/OrderStatusBadges';
import { useAuth } from '../../context/AuthContext';
import { getMyOrders } from '../../lib/api';

const PAGE_SIZE = 10;

export default function MyOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const data = await getMyOrders({ page: pageNum, page_size: PAGE_SIZE });
      setOrders(data.results);
      setTotal(data.total);
      setPage(pageNum);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.replace('/login?redirect=/orders');
    else load(1);
  }, [authLoading, isAuthenticated, load, router]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 py-8 md:py-16">
        <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
          My <span className="text-blue-600">Orders.</span>
        </h1>
        {user && <p className="text-slate-500 mt-2 mb-8">Hi {user.full_name?.split(' ')[0] || 'there'}, here is everything you have ordered.</p>}

        {error && <div className="bg-red-50 text-red-600 rounded-2xl p-4 text-sm font-bold mb-6">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center flex flex-col items-center gap-4">
            <ShoppingBag className="w-12 h-12 text-slate-200" />
            <p className="text-slate-500">You have not placed any orders yet.</p>
            <Link href="/shop" className="px-6 py-3 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest">Start shopping</Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="block bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-4 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <p className="font-black text-blue-950">{o.order_number}</p>
                      <p className="text-xs text-slate-500">{o.date}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={o.status} />
                      <PaymentBadge status={o.payment_status} method={o.payment_method} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {o.items.slice(0, 4).map((item) => (
                        <div key={item.id} className="w-12 h-12 md:w-14 md:h-14 rounded-2xl border-2 border-white bg-slate-100 overflow-hidden">
                          {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-3.5 text-slate-300" />}
                        </div>
                      ))}
                    </div>
                    <p className="flex-1 text-sm text-slate-600 line-clamp-2 min-w-0">
                      {o.items.map((i) => i.name).join(', ')}
                    </p>
                    <div className="text-right shrink-0">
                      <p className="font-black text-blue-950">₹{o.total_amount.toLocaleString('en-IN')}</p>
                      <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-sm font-bold disabled:opacity-40">Previous</button>
            <span className="text-sm text-slate-500">Page {page} of {pages}</span>
            <button disabled={page >= pages || loading} onClick={() => load(page + 1)} className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-sm font-bold disabled:opacity-40">Next</button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
