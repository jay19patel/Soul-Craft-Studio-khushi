import React from 'react';
import Link from 'next/link';
import { Star, Quote } from 'lucide-react';
import YouTubeEmbed from './YouTubeEmbed';

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
      ))}
    </div>
  );
}

function initials(name) {
  return String(name || 'C')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function TextCard({ t, productName }) {
  return (
    <div className="w-[300px] md:w-[380px] shrink-0 px-2 md:px-3">
      <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xl shadow-slate-200/50 border border-slate-100 h-full flex flex-col gap-5 relative">
        <Quote className="absolute top-5 right-5 w-10 h-10 text-orange-50 rotate-12" />
        <Stars rating={t.rating} />
        <p className="text-slate-600 italic leading-relaxed text-sm md:text-base flex-grow line-clamp-6">&ldquo;{t.content}&rdquo;</p>
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <span className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 font-black flex items-center justify-center text-sm">{initials(t.author_name)}</span>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-blue-950 text-sm truncate">{t.author_name}</span>
            <span className="text-xs text-slate-500 truncate">
              {t.author_location || 'Verified customer'}
              {productName ? ` · ${productName}` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Customer stories: video reviews (YouTube, often Shorts) first, then text
 * reviews in a slow marquee. Managed from Admin → Reviews.
 */
export default function Testimonials({ testimonials = [], products = [], heading = true }) {
  if (!testimonials.length) return null;
  const productNames = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const videoReviews = testimonials.filter((t) => t.youtube_id);
  const textReviews = testimonials.filter((t) => !t.youtube_id && t.content);
  const marquee = textReviews.length >= 3 ? [...textReviews, ...textReviews] : textReviews;

  return (
    <section id="testimonials" className="w-full py-16 md:py-24 overflow-hidden bg-slate-50 relative scroll-mt-20">
      {heading && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mb-10 md:mb-14 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 font-bold text-sm mb-5">
            <Star className="w-4 h-4 fill-orange-500" />
            <span>Customer Stories</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-blue-950 tracking-tight">
            Loved by our <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">Community</span>
          </h2>
          <p className="text-slate-600 mt-4 max-w-2xl mx-auto text-base md:text-lg">
            Real feedback — and real unboxings — from people who brought our handmade pieces home.
          </p>
        </div>
      )}

      {videoReviews.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mb-12">
          <div className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {videoReviews.map((t) => (
              <div key={t.id} className={`${t.is_short ? 'w-[62%] sm:w-[38%] md:w-[250px]' : 'w-[88%] sm:w-[60%] md:w-[460px]'} shrink-0 snap-center flex flex-col gap-3`}>
                <YouTubeEmbed videoId={t.youtube_id} title={t.author_name} vertical={t.is_short} />
                <div className="flex flex-col gap-1 px-1">
                  <Stars rating={t.rating} />
                  {t.content && <p className="text-sm text-slate-600 line-clamp-2">&ldquo;{t.content}&rdquo;</p>}
                  <span className="text-xs font-bold text-blue-950">
                    {t.author_name}
                    {t.product_id && productNames[t.product_id] && (
                      <Link href={`/shop/${t.product_id}`} className="text-orange-600 font-semibold"> · {productNames[t.product_id]}</Link>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {textReviews.length > 0 && (
        <div className="relative w-full flex overflow-hidden py-2">
          <div className={`flex shrink-0 ${textReviews.length >= 3 ? 'animate-marquee hover:[animation-play-state:paused]' : 'mx-auto overflow-x-auto scrollbar-hide px-4'}`} style={{ width: 'fit-content' }}>
            {marquee.map((t, idx) => (
              <TextCard key={`${t.id}-${idx}`} t={t} productName={productNames[t.product_id]} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
