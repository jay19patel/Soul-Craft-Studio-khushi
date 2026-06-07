"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import Link from 'next/link';
import {
  ChevronLeft, Package, Truck, CheckCircle, Clock, X,
  MapPin, CreditCard, ShieldCheck, Printer
} from 'lucide-react';
import { getOrder, normalizeOrder } from '../../../lib/api';

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:    { Icon: Clock,       color: 'text-orange-500', bg: 'bg-orange-50 border-orange-100',  label: 'Pending' },
  processing: { Icon: Clock,       color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-100',  label: 'Processing' },
  shipped:    { Icon: Truck,       color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-100',      label: 'Shipped' },
  delivered:  { Icon: CheckCircle, color: 'text-green-500',  bg: 'bg-green-50 border-green-100',    label: 'Delivered' },
  cancelled:  { Icon: X,           color: 'text-red-400',    bg: 'bg-red-50 border-red-100',        label: 'Cancelled' },
};

const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'Payment pending', color: 'text-slate-600 bg-slate-50 border-slate-100' },
  received: { label: 'Awaiting verification', color: 'text-orange-600 bg-orange-50 border-orange-100' },
  verified: { label: 'Verified', color: 'text-green-600 bg-green-50 border-green-100' },
  failed: { label: 'Failed', color: 'text-red-500 bg-red-50 border-red-100' },
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOrder(id)
      .then((raw) => setOrder(normalizeOrder(raw)))
      .catch((err) => setError(err.message || 'Order not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </main>
        <Footer />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center gap-6 text-center px-4">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
            Order Not Found
          </h1>
          <p className="text-slate-500 max-w-sm">{error || 'This order does not exist.'}</p>
          <Link href="/orders" className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
            My Orders
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status?.toLowerCase()] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.Icon;
  const paymentCfg = PAYMENT_STATUS_CONFIG[order.payment_status?.toLowerCase()] ?? PAYMENT_STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-grow w-full max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-8">
          {/* Back */}
          <Link
            href="/orders"
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500 w-fit transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            My Orders
          </Link>

          {/* Title + Status */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
                Order Details.
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                ID: {order.id}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-5 py-3 rounded-full border ${statusCfg.bg}`}>
                <StatusIcon className={`w-4 h-4 ${statusCfg.color}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </div>
              <Link
                href={`/orders/${order.id}/invoice`}
                target="_blank"
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Download Invoice</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="md:col-span-2 flex flex-col gap-6">
              {/* Items */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col gap-6">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-950 pb-4 border-b border-slate-50">
                  Items Ordered
                </h2>
                <div className="flex flex-col gap-5">
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-grow flex flex-col gap-1">
                        <p className="text-sm font-black uppercase text-blue-950">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-blue-950">
                          ₹{((item.price ?? 0) * item.quantity).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-slate-400">@₹{(item.price ?? 0).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="border-t border-slate-50 pt-5 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total</span>
                  <span className="text-xl font-black text-blue-600">
                    ₹{(order.total_amount ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Order Timeline Tracker */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-950">Order Tracking</h2>
                </div>
                
                <div className="flex flex-col gap-0 pl-4 md:pl-6 relative mt-2">
                  <div className="absolute left-[31px] md:left-[39px] top-4 bottom-4 w-[2px] bg-slate-100" />

                  {/* 1. Order Placed */}
                  <div className={`flex items-start gap-6 relative z-10 py-4 ${order.date ? 'opacity-100' : 'opacity-40 grayscale'} ${order.status === 'CANCELLED' ? 'opacity-50 grayscale' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${order.date && order.status !== 'CANCELLED' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-400'}`}>
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <p className={`text-sm font-black uppercase tracking-wider ${order.date && order.status !== 'CANCELLED' ? 'text-indigo-950' : 'text-slate-500'}`}>Order Placed</p>
                      <p className="text-xs font-bold text-slate-400">{order.date || 'Pending'}</p>
                    </div>
                  </div>

                  {/* 2. Payment Verified */}
                  <div className={`flex items-start gap-6 relative z-10 py-4 ${order.payment_verified_date ? 'opacity-100' : 'opacity-40 grayscale'} ${order.status === 'CANCELLED' ? 'opacity-50 grayscale' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${order.payment_verified_date && order.status !== 'CANCELLED' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-200 text-slate-400'}`}>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <p className={`text-sm font-black uppercase tracking-wider ${order.payment_verified_date && order.status !== 'CANCELLED' ? 'text-emerald-950' : 'text-slate-500'}`}>Payment Verified</p>
                      <p className="text-xs font-bold text-slate-400">{order.payment_verified_date || 'Awaiting verification'}</p>
                    </div>
                  </div>

                  {/* 3. Processing */}
                  <div className={`flex items-start gap-6 relative z-10 py-4 ${order.processing_date ? 'opacity-100' : 'opacity-40 grayscale'} ${order.status === 'CANCELLED' ? 'opacity-50 grayscale' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${order.processing_date && order.status !== 'CANCELLED' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-200 text-slate-400'}`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <p className={`text-sm font-black uppercase tracking-wider ${order.processing_date && order.status !== 'CANCELLED' ? 'text-orange-950' : 'text-slate-500'}`}>Processing</p>
                      <p className="text-xs font-bold text-slate-400">{order.processing_date || 'Awaiting processing'}</p>
                    </div>
                  </div>

                  {/* 4. Shipped */}
                  <div className={`flex items-start gap-6 relative z-10 py-4 ${order.shipped_date ? 'opacity-100' : 'opacity-40 grayscale'} ${order.status === 'CANCELLED' ? 'hidden' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${order.shipped_date ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-400'}`}>
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <p className={`text-sm font-black uppercase tracking-wider ${order.shipped_date ? 'text-blue-950' : 'text-slate-500'}`}>Shipped</p>
                      <p className="text-xs font-bold text-slate-400">{order.shipped_date || 'Pending shipment'}</p>
                    </div>
                  </div>

                  {/* 5. Delivered */}
                  <div className={`flex items-start gap-6 relative z-10 py-4 ${order.delivered_date ? 'opacity-100' : 'opacity-40 grayscale'} ${order.status === 'CANCELLED' ? 'hidden' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${order.delivered_date ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-slate-200 text-slate-400'}`}>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <p className={`text-sm font-black uppercase tracking-wider ${order.delivered_date ? 'text-green-950' : 'text-slate-500'}`}>Delivered</p>
                      <p className="text-xs font-bold text-slate-400">{order.delivered_date || 'Awaiting delivery'}</p>
                    </div>
                  </div>

                  {/* Cancelled State Overlay (if cancelled) */}
                  {order.status === 'CANCELLED' && (
                    <div className="flex items-start gap-6 relative z-10 py-4 opacity-100">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500 text-white shadow-lg shadow-red-200">
                        <X className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col gap-1 pt-1">
                        <p className="text-sm font-black uppercase tracking-wider text-red-950">Cancelled</p>
                        <p className="text-xs font-bold text-slate-400">{order.cancelled_date || 'Order was cancelled'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-950">Shipping Address</h2>
                </div>
                <div className="text-sm text-slate-600 leading-relaxed pl-1">
                  <p className="font-black text-blue-950">{order.customer_name}</p>
                  {order.shipping_address && <p>{order.shipping_address}</p>}
                  {order.customer_phone && (
                    <p className="text-slate-400 mt-1">📞 {order.customer_phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-6">
              {/* Customer info */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</h2>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-black text-blue-950">{order.customer_name}</p>
                  <p className="text-xs text-slate-500">{order.customer_email}</p>
                </div>
              </div>

              {/* Payment */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment</h2>
                </div>
                <div className="flex flex-col gap-3">
                  <div className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 ${paymentCfg.color}`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {paymentCfg.label}
                  </div>
                  {order.payment_reference && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Payment Reference</span>
                      <span className="text-xs font-mono text-slate-600 break-all">{order.payment_reference}</span>
                    </div>
                  )}
                  {order.upi_transaction_id && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">UPI Transaction ID</span>
                      <span className="text-xs font-mono text-slate-600 break-all">{order.upi_transaction_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order date */}
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Placed On</span>
                <span className="text-sm font-bold text-slate-700">{order.date}</span>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="bg-orange-50 rounded-[32px] border border-orange-100 p-6 flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Notes</span>
                  <p className="text-sm text-orange-900">{order.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderDetailPage;
