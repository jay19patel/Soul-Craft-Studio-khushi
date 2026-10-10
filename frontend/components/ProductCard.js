import React from 'react';
import Link from 'next/link';
import { PlayCircle } from 'lucide-react';

/** Compact product tile used on the shop grid and "new arrivals". */
export default function ProductCard({ product }) {
  const price = Number(product.price_value ?? product.priceValue ?? 0);
  const sale = Number(product.sale_price ?? product.salePrice ?? price);
  const image = product.image || product.primary_image;
  const soldOut = Number(product.stock) <= 0;
  const hasVideo = (product.videos || []).length > 0;

  return (
    <Link href={`/shop/${product.id}`} className="group flex flex-col gap-3 md:gap-4">
      <div className="aspect-square relative rounded-3xl md:rounded-[32px] overflow-hidden bg-white border border-slate-100 group-hover:shadow-xl transition-all duration-500">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${soldOut ? 'opacity-60 grayscale-[30%]' : ''}`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {soldOut ? (
            <span className="px-2.5 py-1 bg-slate-900/85 text-white rounded-full text-[10px] font-black uppercase tracking-widest">Sold out</span>
          ) : product.discount > 0 ? (
            <span className="px-2.5 py-1 bg-orange-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{product.discount}% off</span>
          ) : null}
        </div>
        {hasVideo && (
          <span className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 text-orange-600 flex items-center justify-center shadow" title="Has video">
            <PlayCircle className="w-5 h-5" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 px-1">
        {product.category?.name && (
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">{product.category.name}</span>
        )}
        <h3 className="text-sm md:text-base font-bold text-blue-950 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-base md:text-lg font-black text-blue-950">₹{sale.toLocaleString('en-IN')}</span>
          {sale < price && <span className="text-xs md:text-sm line-through text-slate-400">₹{price.toLocaleString('en-IN')}</span>}
        </div>
      </div>
    </Link>
  );
}
