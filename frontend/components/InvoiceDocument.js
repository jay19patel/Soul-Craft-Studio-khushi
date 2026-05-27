"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Printer } from 'lucide-react';
import siteData from '../data/siteData.json';

const { brand } = siteData;

export default function InvoiceDocument({ order, backHref, backLabel }) {
  return (
    <div className="min-h-screen bg-[#f5f3ef] print:bg-white text-[#302d2a]">
      <div className="print:hidden flex justify-between items-center px-5 py-4 bg-white border-b border-stone-200">
        <Link href={backHref} className="flex gap-2 items-center text-sm font-bold text-slate-600">
          <ChevronLeft className="w-4 h-4" /> {backLabel}
        </Link>
        <button onClick={() => window.print()} className="flex gap-2 items-center rounded-full px-6 py-3 bg-slate-900 text-white text-sm font-bold">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      <main className="max-w-[760px] mx-auto bg-white my-8 print:my-0 border border-stone-200 print:border-0">
        <header className="px-10 py-8 text-center border-b border-stone-100">
          <img src="/logo.png" alt={brand.name} className="w-16 h-16 object-contain mx-auto mb-3 mix-blend-multiply" />
          <p className="font-serif text-4xl font-bold text-orange-700">{brand.name}</p>
          <p className="text-[10px] tracking-[0.3em] uppercase text-stone-500 mt-2">Handcrafted with love</p>
        </header>
        <section className="px-10 py-9">
          <h1 className="text-center text-3xl font-bold">Invoice</h1>

          <div className="grid grid-cols-2 bg-stone-50 border border-stone-200 rounded mt-8 mb-9">
            <InvoiceStat label="Invoice number" value={`SCS-${order.id}`} />
            <InvoiceStat label="Invoice date" value={new Date(order.created_at).toLocaleDateString('en-IN')} />
            <InvoiceStat label="Payment reference" value={order.payment_id || 'Not provided'} />
          </div>

          <h2 className="text-lg font-bold mb-4">Order details</h2>
          <div className="border border-stone-200 rounded overflow-hidden">
            <div className="grid grid-cols-[1fr_56px_120px] text-[11px] uppercase tracking-wider text-stone-500 font-bold bg-stone-50 p-4">
              <span>Description</span><span>Qty</span><span className="text-right">Amount</span>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_56px_120px] p-4 items-center border-t border-stone-100 text-sm">
                <div className="flex gap-4 items-center">
                  {item.image && <img src={item.image} alt="" className="w-14 h-14 rounded object-cover" />}
                  <span className="font-bold">{item.name}</span>
                </div>
                <span>{item.quantity}</span>
                <span className="text-right font-bold">Rs. {(Number(item.price) * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 border border-stone-200 rounded mt-8">
            <div className="p-5 border-r border-stone-200">
              <h2 className="font-bold mb-3">Shipping address</h2>
              <p className="font-bold text-sm">{order.customer_name}</p>
              <p className="text-sm text-stone-600 leading-6 mt-1">{order.shipping_address}<br />{order.customer_email}</p>
            </div>
            <div className="p-5">
              <h2 className="font-bold mb-3">Payment details</h2>
              <PaymentDetail label="Payment reference" value={order.payment_reference || 'Not provided'} />
              <PaymentDetail label="UPI transaction ID" value={order.upi_transaction_id || 'Not provided'} />
            </div>
          </div>
        </section>
        <footer className="border-t border-stone-100 py-6 text-center text-xs text-stone-500">Thank you for shopping with {brand.name}. Keep this invoice for your records.</footer>
      </main>
    </div>
  );
}

function PaymentDetail({ label, value }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[10px] uppercase tracking-wider font-bold text-stone-500">{label}</p>
      <p className="text-sm font-bold text-stone-700 mt-1 break-all">{value}</p>
    </div>
  );
}

function InvoiceStat({ label, value }) {
  return (
    <div className="p-4 border-r last:border-r-0 border-stone-200">
      <p className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">{label}</p>
      <p className="font-bold text-sm mt-2">{value}</p>
    </div>
  );
}
