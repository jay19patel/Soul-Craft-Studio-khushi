"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrder, normalizeOrder } from '../../../../lib/api';
import { Printer, ChevronLeft, Package } from 'lucide-react';
import Link from 'next/link';

export default function InvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOrder(id)
      .then((raw) => {
        setOrder(normalizeOrder(raw));
        // Small delay to ensure images load before print dialog
        setTimeout(() => {
          window.print();
        }, 500);
      })
      .catch((err) => setError(err.message || 'Order not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-red-500 font-bold">{error || 'Order not found.'}</p>
        <button onClick={() => router.back()} className="text-indigo-600 underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white font-sans text-slate-900 selection:bg-indigo-100">
      
      {/* Non-printable action bar */}
      <div className="print:hidden bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <Link href={`/orders/${order.id}`} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Order
        </Link>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Printable Invoice Container */}
      <main className="max-w-4xl mx-auto p-8 md:p-12 print:p-0 print:max-w-none bg-white md:my-8 rounded-[40px] md:shadow-xl print:shadow-none print:my-0 border border-slate-100 print:border-none">
        
        {/* Invoice Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-slate-100 pb-12">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-[family-name:var(--font-climate-crisis)] uppercase text-indigo-950">
              INVOICE.
            </h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">
              Khushi Website
            </p>
          </div>
          <div className="flex flex-col gap-1 text-left md:text-right">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Invoice Number</p>
            <p className="text-lg font-mono font-bold text-slate-900">INV-{order.id.padStart(6, '0')}</p>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Date of Issue</p>
            <p className="text-sm font-bold text-slate-900">{order.date}</p>
          </div>
        </div>

        {/* Customer & Shipping Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2">Billed To</h3>
            <div className="text-sm text-slate-700 font-medium leading-relaxed">
              <p className="font-bold text-indigo-950 text-base mb-1">{order.customer_name}</p>
              <p>{order.customer_email}</p>
              <p>{order.customer_phone}</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2">Shipped To</h3>
            <div className="text-sm text-slate-700 font-medium leading-relaxed">
              <p className="font-bold text-indigo-950 text-base mb-1">{order.customer_name}</p>
              <p>{order.shipping_address}</p>
              <p>{[order.city, order.state, order.pincode].filter(Boolean).join(', ')}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-12">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Description</th>
                <th className="py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400 text-center">Qty</th>
                <th className="py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400 text-right">Price</th>
                <th className="py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(order.items || []).map((item, idx) => (
                <tr key={idx} className="group">
                  <td className="py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 print:hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-slate-300 m-auto mt-3" />
                        )}
                      </div>
                      <span className="text-sm font-bold uppercase text-indigo-950">{item.name}</span>
                    </div>
                  </td>
                  <td className="py-6 text-center text-sm font-bold text-slate-600">{item.quantity}</td>
                  <td className="py-6 text-right text-sm font-bold text-slate-600">₹{(item.price ?? 0).toLocaleString('en-IN')}</td>
                  <td className="py-6 text-right text-sm font-black text-indigo-950">
                    ₹{((item.price ?? 0) * item.quantity).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex flex-col items-end gap-4 border-t border-slate-100 pt-8 mb-16">
          <div className="flex justify-between w-64 text-sm font-bold text-slate-600">
            <span>Subtotal</span>
            <span>₹{(order.total_amount ?? 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between w-64 text-sm font-bold text-slate-600">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <div className="w-64 h-px bg-slate-100 my-2" />
          <div className="flex justify-between w-64 items-center">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Total Amount</span>
            <span className="text-2xl font-black text-indigo-600">₹{(order.total_amount ?? 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-t border-slate-100 pt-8 flex flex-col items-center text-center gap-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thank you for your purchase!</p>
          <p className="text-[10px] text-slate-400">If you have any questions concerning this invoice, please contact support.</p>
        </div>

      </main>
    </div>
  );
}
