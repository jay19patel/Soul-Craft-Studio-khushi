'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Heart, Star, ShoppingBag, ArrowRight } from 'lucide-react';
import YouTubeEmbed from './YouTubeEmbed';

/**
 * Homepage hero. Text, button label and the optional hero video come from
 * Admin → Homepage; the photo collage uses the featured products' photos.
 */
const Hero = ({ home = {}, collage = [], reviewCount = 0 }) => {
  const title = home.hero_title || 'Soul Craft Studio';
  const words = title.split(' ');
  const lastWord = words.length > 1 ? words.pop() : '';
  const firstWords = words.join(' ');
  const images = [...collage, '/images/cat_fashion.png', '/images/cat_accessories.png', '/images/cat_decor.png'].slice(0, 3);

  return (
    <section className="relative w-full flex items-center overflow-hidden bg-slate-50 border-b border-orange-100 lg:min-h-[calc(100vh-80px)]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[70vw] md:w-[50vw] h-[70vw] md:h-[50vw] bg-orange-200/50 rounded-full blur-[80px] md:blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] md:w-[50vw] h-[70vw] md:h-[50vw] bg-blue-100/50 rounded-full blur-[80px] md:blur-[120px] opacity-60" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-8 flex flex-col lg:flex-row items-center gap-10 lg:gap-16 py-12 md:py-16 lg:py-20">
        <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
          {home.hero_badge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-orange-100/80 border border-orange-200 mb-6 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="text-orange-700 text-xs md:text-sm font-bold tracking-wide">{home.hero_badge}</span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[2.6rem] leading-[1] sm:text-6xl lg:text-7xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 tracking-tight mb-5"
          >
            <span className="block">{firstWords}</span>
            {lastWord && (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400 block mt-1 md:mt-2">{lastWord}</span>
            )}
          </motion.h1>

          {home.hero_subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="text-base sm:text-lg md:text-xl text-slate-600 max-w-xl font-medium leading-relaxed mb-8"
            >
              {home.hero_subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
          >
            <Link
              href="/shop"
              className="flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-4 rounded-full font-bold text-base md:text-lg shadow-[0_10px_30px_-10px_rgba(249,115,22,0.6)] transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <ShoppingBag className="w-5 h-5" />
              {home.hero_cta_label || 'Shop Collections'}
            </Link>
            <a
              href="#featured"
              className="group flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 px-8 py-3.5 rounded-full font-bold text-base md:text-lg transition-all"
            >
              Explore pieces
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>

          {reviewCount > 0 && (
            <motion.a
              href="#testimonials"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mt-8 flex items-center gap-3 text-slate-600"
            >
              <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-4 h-4 text-amber-500 fill-amber-500" />
                ))}
              </span>
              <span className="text-sm font-medium">
                <strong>{reviewCount}+</strong> happy customer stories
              </span>
            </motion.a>
          )}
        </div>

        <div className="w-full lg:w-1/2">
          {home.hero_video_id ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="shadow-2xl shadow-slate-300/60 rounded-[32px]">
              <YouTubeEmbed videoId={home.hero_video_id} title={home.story_title || 'Our story'} rounded="rounded-[32px]" />
            </motion.div>
          ) : (
            <>
              {/* Mobile: simple swipeable strip */}
              <div className="flex md:hidden gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                {images.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-[70%] aspect-[4/5] object-cover rounded-3xl shrink-0 snap-center shadow-lg" />
                ))}
              </div>
              {/* Desktop: collage */}
              <div className="hidden md:flex relative h-[460px] lg:h-[580px] items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.9, type: 'spring' }}
                  className="absolute z-10 w-[260px] lg:w-[320px] h-[340px] lg:h-[420px] rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-300/60 border border-white"
                >
                  <img src={images[0]} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5 flex items-center gap-2 text-white">
                    <span className="p-1.5 bg-white/20 rounded-full backdrop-blur-md">
                      <Heart className="w-4 h-4 text-orange-400 fill-orange-400" />
                    </span>
                    <span className="font-semibold text-sm">Knitted with Love</span>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className="absolute z-20 top-[2%] right-[6%] w-36 lg:w-48 h-44 lg:h-56 rounded-3xl overflow-hidden shadow-xl border-[6px] border-white bg-slate-100"
                >
                  <img src={images[1]} alt="" className="w-full h-full object-cover" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="absolute z-20 bottom-[6%] left-[6%] w-40 lg:w-52 h-44 lg:h-56 rounded-3xl overflow-hidden shadow-xl border-[6px] border-white bg-slate-100"
                >
                  <img src={images[2]} alt="" className="w-full h-full object-cover" />
                </motion.div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;
