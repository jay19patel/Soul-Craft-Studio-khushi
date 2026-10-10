"use client";

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Check, Truck, ShieldCheck, HandHeart, ChevronRight, Star, PlayCircle } from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import YouTubeEmbed from '../../../components/YouTubeEmbed';
import ProductCard from '../../../components/ProductCard';

export default function ProductDetail({ product, related = [], reviews = [], shipping = {} }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const scroller = useRef(null);

  const images = product.images.length ? product.images : [];
  const soldOut = product.stock <= 0;
  const maxQty = Math.max(1, Math.min(20, product.stock));
  const price = product.priceValue;
  const sale = product.salePrice;
  const videos = product.videos || [];
  const threshold = Number(shipping.free_shipping_threshold || 0);

  const goTo = (i) => {
    setActive(i);
    scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });
  };

  const handleAdd = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = () => {
    addToCart(product, qty, { open: false });
    router.push(isAuthenticated ? '/checkout' : '/login?redirect=/checkout');
  };

  return (
    <>
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-8 pt-5 pb-28 md:py-14">
        <nav className="flex items-center gap-1.5 mb-5 md:mb-10 text-[11px] font-bold uppercase tracking-widest text-slate-400 overflow-hidden">
          <Link href="/" className="hover:text-orange-500 shrink-0">Home</Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <Link href="/shop" className="hover:text-orange-500 shrink-0">Shop</Link>
          {product.category && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <Link href={`/shop?category_id=${product.category.id}`} className="hover:text-orange-500 truncate">{product.category.name}</Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-14 items-start">
          {/* Gallery */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-28">
            <div className="relative rounded-[28px] md:rounded-[40px] overflow-hidden bg-slate-50 border border-slate-100 -mx-1 md:mx-0">
              <div
                ref={scroller}
                onScroll={() => {
                  const el = scroller.current;
                  if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
                }}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-square md:aspect-[4/5]"
              >
                {images.length ? (
                  images.map((src, i) => (
                    <img key={src + i} src={src} alt={`${product.name} — photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} className="w-full h-full object-cover shrink-0 snap-center" />
                  ))
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200" />
                )}
              </div>
              {product.discount > 0 && !soldOut && (
                <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest">{product.discount}% off</span>
              )}
              {images.length > 1 && (
                <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5 md:hidden">
                  {images.map((_, i) => (
                    <span key={i} className={`h-2 rounded-full transition-all ${active === i ? 'w-6 bg-white' : 'w-2 bg-white/60'}`} />
                  ))}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="hidden md:flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    onClick={() => goTo(i)}
                    className={`w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${active === i ? 'border-orange-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    aria-label={`Show photo ${i + 1}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              {product.category && (
                <span className="text-orange-600 font-extrabold tracking-widest uppercase text-xs">{product.category.name}</span>
              )}
              <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">{product.name}</h1>
              {product.tagline && <p className="text-lg text-slate-600 font-medium">{product.tagline}</p>}
              {reviews.length > 0 && (
                <a href="#reviews" className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="flex">
                    {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                  </span>
                  {reviews.length} review{reviews.length > 1 ? 's' : ''}
                </a>
              )}
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <span className="text-3xl md:text-4xl font-black text-blue-950">₹{sale.toLocaleString('en-IN')}</span>
                {sale < price && (
                  <>
                    <span className="text-lg line-through text-slate-400">₹{price.toLocaleString('en-IN')}</span>
                    <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-black">
                      Save ₹{(price - sale).toLocaleString('en-IN')}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-slate-400">Inclusive of all taxes</span>
            </div>

            <div className={`inline-flex w-fit items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${soldOut ? 'bg-red-50 text-red-500' : product.stock <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <span className={`w-2 h-2 rounded-full ${soldOut ? 'bg-red-400' : product.stock <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {soldOut ? 'Sold out' : product.stock <= 3 ? `Only ${product.stock} left` : 'In stock'}
            </div>

            {!soldOut && (
              <div className="hidden md:flex flex-col gap-4">
                <QtyPicker qty={qty} setQty={setQty} max={maxQty} />
                <div className="flex gap-3">
                  <button onClick={handleBuyNow} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-orange-100 transition-all active:scale-[0.98]">
                    Buy now
                  </button>
                  <button
                    onClick={handleAdd}
                    className={`flex-1 border-2 py-4 rounded-full font-black uppercase tracking-widest text-sm transition-all ${added ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-blue-950 text-blue-950 hover:bg-slate-50'}`}
                  >
                    {added ? 'Added ✓' : 'Add to cart'}
                  </button>
                </div>
              </div>
            )}

            {product.highlights.length > 0 && (
              <ul className="flex flex-col gap-2.5 bg-[#fbf7f2] rounded-3xl p-5 md:p-6">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 text-sm md:text-base text-slate-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            )}

            {product.description && (
              <div className="flex flex-col gap-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">About this piece</h2>
                <p className="text-slate-600 text-base leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-6">
              <Badge icon={HandHeart} label="Handmade" />
              <Badge icon={Truck} label={threshold > 0 ? `Free ship ₹${threshold}+` : shipping.estimated_delivery || 'Fast shipping'} />
              <Badge icon={ShieldCheck} label="Secure payment" />
            </div>

            {videos.length > 0 && (
              <a href="#videos" className="md:hidden inline-flex items-center gap-2 text-sm font-bold text-orange-600">
                <PlayCircle className="w-5 h-5" /> Watch {videos.length} video{videos.length > 1 ? 's' : ''} of this piece
              </a>
            )}
          </div>
        </div>

        {/* Videos */}
        {videos.length > 0 && (
          <section id="videos" className="mt-16 md:mt-24 scroll-mt-24">
            <h2 className="text-2xl md:text-4xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 mb-2">See it in action</h2>
            <p className="text-slate-500 mb-8">Close-ups, making-of and real use — straight from our studio.</p>
            <div className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
              {videos.map((v) => (
                <div key={v.id} className={`shrink-0 snap-center ${v.is_short ? 'w-[62%] sm:w-[40%] md:w-auto md:max-w-[300px]' : 'w-[88%] md:w-auto md:col-span-1'}`}>
                  <YouTubeEmbed videoId={v.youtube_id} title={v.title || product.name} vertical={v.is_short} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section id="reviews" className="mt-16 md:mt-24 scroll-mt-24">
            <h2 className="text-2xl md:text-4xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 mb-8">Customer reviews</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((r) => (
                <div key={r.id} className="bg-slate-50 rounded-3xl p-5 flex flex-col gap-3 border border-slate-100">
                  {r.youtube_id && <YouTubeEmbed videoId={r.youtube_id} title={r.author_name} vertical={r.is_short} rounded="rounded-2xl" />}
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </span>
                  {r.content && <p className="text-sm text-slate-600 leading-relaxed">&ldquo;{r.content}&rdquo;</p>}
                  <span className="text-xs font-bold text-blue-950">{r.author_name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16 md:mt-24">
            <h2 className="text-2xl md:text-4xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 mb-8">You may also love</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8 md:gap-8">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </main>

      {/* Mobile sticky buy bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3 pb-safe">
        {soldOut ? (
          <div className="py-3 text-center text-sm font-black uppercase tracking-widest text-slate-400">Sold out — check back soon</div>
        ) : (
          <div className="flex items-center gap-3">
            <QtyPicker qty={qty} setQty={setQty} max={maxQty} compact />
            <button
              onClick={handleAdd}
              className={`flex-1 py-3.5 rounded-full border-2 font-black uppercase tracking-wider text-xs ${added ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-blue-950 text-blue-950'}`}
            >
              {added ? 'Added ✓' : 'Add'}
            </button>
            <button onClick={handleBuyNow} className="flex-[1.4] py-3.5 rounded-full bg-orange-500 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-orange-200">
              Buy ₹{(sale * qty).toLocaleString('en-IN')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function QtyPicker({ qty, setQty, max, compact = false }) {
  return (
    <div className={`flex items-center bg-slate-100 rounded-full w-fit ${compact ? '' : 'p-1'}`}>
      <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:opacity-30" aria-label="Decrease quantity">
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-8 text-center font-black text-blue-950">{qty}</span>
      <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:opacity-30" aria-label="Increase quantity">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function Badge({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-tight">{label}</span>
    </div>
  );
}
