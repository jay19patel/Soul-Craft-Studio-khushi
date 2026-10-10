import React from 'react';
import { HandHeart, Truck, ShieldCheck, Palette } from 'lucide-react';

export default function TrustStrip({ shipping = {} }) {
  const threshold = Number(shipping.free_shipping_threshold || 0);
  const items = [
    { icon: HandHeart, title: '100% Handmade', text: 'Every loop knitted by hand' },
    {
      icon: Truck,
      title: threshold > 0 ? `Free shipping ₹${threshold.toLocaleString('en-IN')}+` : Number(shipping.flat_fee || 0) === 0 ? 'Free shipping' : 'Pan-India shipping',
      text: shipping.estimated_delivery ? `Delivered in ${shipping.estimated_delivery}` : 'Carefully packed',
    },
    { icon: ShieldCheck, title: 'Secure payments', text: 'UPI or cash on delivery' },
    { icon: Palette, title: 'Custom orders', text: 'Made just for you' },
  ];
  return (
    <section className="w-full bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-black text-blue-950 leading-tight">{title}</span>
              <span className="text-xs text-slate-500 leading-tight mt-0.5">{text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
