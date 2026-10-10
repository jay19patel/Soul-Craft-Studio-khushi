"use client";

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';
import YouTubeEmbed from './YouTubeEmbed';

const THEMES = [
  {
    section: 'bg-[#fbf7f2]',
    eyebrow: 'text-orange-600',
    title: 'text-blue-950',
    body: 'text-slate-600',
    chip: 'bg-white border-orange-100 text-blue-950',
    check: 'bg-orange-500 text-white',
    price: 'text-blue-950',
    primary: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200',
    secondary: 'border-blue-950/15 text-blue-950 hover:bg-white',
  },
  {
    section: 'bg-blue-950',
    eyebrow: 'text-orange-300',
    title: 'text-white',
    body: 'text-blue-100/80',
    chip: 'bg-white/10 border-white/10 text-white',
    check: 'bg-orange-400 text-blue-950',
    price: 'text-white',
    primary: 'bg-orange-500 hover:bg-orange-400 text-white shadow-black/20',
    secondary: 'border-white/20 text-white hover:bg-white/10',
  },
  {
    section: 'bg-orange-50',
    eyebrow: 'text-blue-600',
    title: 'text-blue-950',
    body: 'text-slate-600',
    chip: 'bg-white border-orange-100 text-blue-950',
    check: 'bg-blue-600 text-white',
    price: 'text-blue-950',
    primary: 'bg-blue-950 hover:bg-blue-900 text-white shadow-blue-200',
    secondary: 'border-blue-950/15 text-blue-950 hover:bg-white',
  },
];

/**
 * A full-width "brand page" section for one featured product: photo gallery,
 * story, highlights, price, buy buttons and its YouTube video — configured
 * entirely from Admin → Products (title, tagline, description, highlights,
 * photos, videos, "Show on homepage").
 */
export default function ProductShowcase({ product, index = 0 }) {
  const theme = THEMES[index % THEMES.length];
  const reversed = index % 2 === 1;
  const { addToCart } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);
  const scroller = useRef(null);

  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  const price = Number(product.price_value ?? product.priceValue ?? 0);
  const sale = Number(product.sale_price ?? product.salePrice ?? price);
  const soldOut = Number(product.stock) <= 0;
  const video = (product.videos || [])[0];

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const goTo = (i) => {
    setActiveImage(i);
    scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });
  };

  const handleAdd = () => {
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <section className={`w-full ${theme.section} overflow-hidden`} id={`showcase-${product.slug || product.id}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Media */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className={`lg:col-span-7 flex flex-col gap-3 ${reversed ? 'lg:order-2' : ''}`}
        >
          <div className="relative rounded-[28px] md:rounded-[40px] overflow-hidden shadow-2xl shadow-black/10 bg-white">
            <div
              ref={scroller}
              onScroll={onScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-[4/5] sm:aspect-[5/4] lg:aspect-[6/5]"
            >
              {images.map((src, i) => (
                <img
                  key={src + i}
                  src={src}
                  alt={`${product.name} photo ${i + 1}`}
                  loading={index === 0 && i === 0 ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover shrink-0 snap-center"
                />
              ))}
            </div>
            {product.discount > 0 && !soldOut && (
              <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest shadow">
                {product.discount}% off
              </span>
            )}
            {soldOut && (
              <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-black uppercase tracking-widest">
                Sold out
              </span>
            )}
            {images.length > 1 && (
              <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`Show photo ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${activeImage === i ? 'w-6 bg-white' : 'w-2 bg-white/60'}`}
                  />
                ))}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="hidden sm:flex gap-3 overflow-x-auto scrollbar-hide">
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => goTo(i)}
                  className={`w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${activeImage === i ? 'border-orange-500' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Story */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={`lg:col-span-5 flex flex-col gap-5 ${reversed ? 'lg:order-1' : ''}`}
        >
          <span className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] ${theme.eyebrow}`}>
            <Sparkles className="w-4 h-4" />
            {product.category?.name || 'Featured piece'}
          </span>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase leading-[1.05] ${theme.title}`}>
            {product.name}
          </h2>
          {product.tagline && <p className={`text-lg md:text-xl font-semibold ${theme.body}`}>{product.tagline}</p>}
          {product.description && (
            <p className={`text-sm md:text-base leading-relaxed line-clamp-4 whitespace-pre-line ${theme.body}`}>{product.description}</p>
          )}

          {product.highlights?.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {product.highlights.slice(0, 5).map((h) => (
                <li key={h} className={`flex items-start gap-3 text-sm md:text-base font-medium ${theme.body}`}>
                  <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${theme.check}`}>
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-baseline gap-3 mt-1">
            <span className={`text-3xl md:text-4xl font-black ${theme.price}`}>₹{sale.toLocaleString('en-IN')}</span>
            {sale < price && <span className="text-lg line-through opacity-50">₹{price.toLocaleString('en-IN')}</span>}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAdd}
              disabled={soldOut}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-4 px-6 rounded-full font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${theme.primary}`}
            >
              <ShoppingBag className="w-5 h-5" />
              {soldOut ? 'Sold out' : added ? 'Added ✓' : 'Add to cart'}
            </button>
            <Link
              href={`/shop/${product.id}`}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-4 px-6 rounded-full border-2 font-black uppercase tracking-widest text-sm transition-all ${theme.secondary}`}
            >
              View details <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {video && (
            <div className={video.is_short ? 'max-w-[240px]' : 'w-full'}>
              <YouTubeEmbed videoId={video.youtube_id} title={video.title || `Watch: ${product.name}`} vertical={video.is_short} rounded="rounded-3xl" />
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
