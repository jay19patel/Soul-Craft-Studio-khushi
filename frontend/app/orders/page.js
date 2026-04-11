"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { getOrdersByEmail, normalizeOrder } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { 
  Package, Truck, CheckCircle, Clock, ChevronRight, 
  ShoppingBag, Search, X, AlertCircle 
} from 'lucide-react';

// ── Status helpers ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:             { icon: Clock,        color: 'bg-orange-50 text-orange-600 border-orange-100',  label: 'Pending' },
  processing:          { icon: Clock,        color: 'bg-yellow-50 text-yellow-600 border-yellow-100',  label: 'Processing' },
  shipped:             { icon: Truck,        color: 'bg-blue-50 text-blue-600 border-blue-100',        label: 'Shipped' },
  delivered:           { icon: CheckCircle,  color: 'bg-green-50 text-green-600 border-green-100',     label: 'Delivered' },
  cancelled:           { icon: X,            color: 'bg-red-50 text-red-500 border-red-100',           label: 'Cancelled' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${cfg.color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-black uppercase tracking-[0.1em]">{cfg.label}</span>
    </div>
  );
}

const MyOrdersPage = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  // Define fetch handler
  const fetchOrders = useCallback(async (targetEmail) => {
    if (!targetEmail) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await getOrdersByEmail(targetEmail);
      setOrders(raw.map(normalizeOrder));
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Failed to load orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically fetch if logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.email) {
      setEmail(user.email);
      fetchOrders(user.email);
    }
  }, [authLoading, isAuthenticated, user, fetchOrders]);

  const handleManualSearch = (e) => {
    e.preventDefault();
    fetchOrders(email);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-8 md:gap-12">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
              My <span className="text-blue-600">Orders.</span>
            </h1>
            <p className="text-slate-500 text-lg">
              {isAuthenticated 
                ? `Hello ${user.full_name?.split(' ')[0]}, here are your recent purchases.`
                : "Enter your email address to find and track your orders."}
            </p>
          </div>

          {!isAuthenticated && (
            /* Email Search Form (Only for guests or logged out) */
            <form onSubmit={handleManualSearch} className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 transition-all focus-within:shadow-blue-100">
              <div className="relative flex-grow">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your order email address"
                  className="w-full bg-transparent border-none pl-14 pr-5 py-4 text-sm focus:outline-none placeholder:text-slate-300"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 whitespace-nowrap"
              >
                {loading ? 'Searching...' : (
                  <>
                    <Search className="w-4 h-4" />
                    Track Orders
                  </>
                )}
              </button>
            </form>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center flex items-center justify-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-500 text-sm font-bold">{error}</p>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="flex flex-col gap-8">
              {[1, 2].map(i => (
                <div key={i} className="h-64 bg-white rounded-[40px] animate-pulse border border-slate-100" />
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && searched && (
            <>
              {orders.length === 0 ? (
                <div className="bg-white rounded-[40px] p-16 text-center flex flex-col items-center gap-8 border border-slate-100 shadow-xl shadow-slate-200/40 animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <ShoppingBag className="w-12 h-12" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h3 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">No orders found</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">
                      We couldn&apos;t find any orders for <strong>{email}</strong>.
                    </p>
                  </div>
                  <Link
                    href="/shop"
                    className="bg-orange-500 text-white px-10 py-4 rounded-full font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95"
                  >
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 group animate-in slide-in-from-bottom-4"
                    >
                      <div className="p-8 md:p-10 flex flex-col gap-8">
                        {/* Order Meta */}
                        <div className="flex flex-wrap items-center justify-between gap-6">
                          <div className="flex items-center gap-8">
                             <div className="flex flex-col gap-1">
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Placed</span>
                               <span className="text-sm font-bold text-slate-600">{order.date}</span>
                             </div>
                             <div className="w-px h-8 bg-slate-100 hidden sm:block" />
                             <div className="flex flex-col gap-1">
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Amount</span>
                               <span className="text-sm font-black text-blue-950">₹{(order.total_amount ?? 0).toLocaleString('en-IN')}</span>
                             </div>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>

                        <div className="h-px bg-slate-50 w-full" />

                        {/* Items */}
                        <div className="flex flex-col gap-6">
                          {(order.items || []).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-6 group/item">
                              <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 transition-transform group-hover/item:scale-105">
                                {item.image ? (
                                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-8 h-8 text-slate-200" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-grow flex flex-col gap-1">
                                <h4 className="text-base font-bold text-blue-950 group-hover/item:text-orange-500 transition-colors uppercase">{item.name}</h4>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                  {item.quantity} × ₹{(item.price ?? 0).toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="h-px bg-slate-50 w-full" />

                        {/* Order Detail Link */}
                        <div className="flex justify-between items-center">
                           <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Order #{order.id?.slice(-8)}</div>
                           <Link
                             href={`/orders/${order.id}`}
                             className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-orange-500 transition-all group-hover:translate-x-1"
                           >
                             View Full Details
                             <ChevronRight className="w-4 h-4" />
                           </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Not searched yet — hint for logged out */}
          {!isAuthenticated && !searched && !loading && (
            <div className="bg-white rounded-[40px] p-16 text-center flex flex-col items-center gap-6 border border-slate-100 shadow-xl shadow-slate-200/30">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-300">
                <Package className="w-10 h-10" strokeWidth={1.5} />
              </div>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">
                Already have an account? <Link href="/login" className="text-blue-600 font-bold hover:underline">Log in</Link> to see your orders automatically.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MyOrdersPage;
