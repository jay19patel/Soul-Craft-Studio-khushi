'use client';
import React, { useState, useEffect } from 'react';
import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';
import { getTestimonials } from '../lib/api';

// Pravatar fallback avatars (used when no avatar_url is stored)
const FALLBACK_AVATARS = [
  'https://i.pravatar.cc/150?img=41',
  'https://i.pravatar.cc/150?img=11',
  'https://i.pravatar.cc/150?img=43',
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=44',
];

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTestimonials()
      .then(setTestimonials)
      .catch(() => setTestimonials([]))
      .finally(() => setLoading(false));
  }, []);

  // Double the list for a seamless infinite marquee
  const display = testimonials.length > 0
    ? [...testimonials, ...testimonials]
    : [];

  return (
    <section id="testimonials" className="w-full py-20 overflow-hidden bg-slate-50 relative scroll-mt-20">
      {/* Background blobs */}
      <div className="absolute top-0 right-[-10%] w-[30vw] h-[30vw] bg-orange-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-[-10%] w-[30vw] h-[30vw] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-16 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 font-bold text-sm mb-6"
        >
          <Star className="w-4 h-4 fill-orange-500" />
          <span>Customer Stories</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-extrabold text-blue-950 tracking-tight"
        >
          Loved by our{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">
            Community
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-slate-600 mt-4 max-w-2xl mx-auto text-lg"
        >
          Real feedback from people who have experienced the warmth and quality of our handcrafted woolen art.
        </motion.p>
      </div>

      {/* Scrolling Carousel */}
      {loading ? (
        <div className="flex gap-6 px-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[320px] md:w-[400px] shrink-0 bg-white rounded-3xl p-6 animate-pulse flex flex-col gap-4">
              <div className="w-full h-40 rounded-2xl bg-slate-100" />
              <div className="h-3 bg-slate-100 rounded-full w-full" />
              <div className="h-3 bg-slate-100 rounded-full w-4/5" />
              <div className="h-3 bg-slate-100 rounded-full w-3/5" />
              <div className="flex items-center gap-3 pt-2">
                <div className="w-12 h-12 rounded-full bg-slate-100" />
                <div className="flex flex-col gap-1.5 flex-grow">
                  <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-2 bg-slate-100 rounded-full w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : display.length > 0 ? (
        <div className="relative w-full flex overflow-hidden group py-4">
          <div
            className="flex shrink-0 animate-marquee hover:[animation-play-state:paused]"
            style={{ width: 'fit-content' }}
          >
            {display.map((testimonial, idx) => {
              const avatarSrc =
                testimonial.avatar_url ||
                FALLBACK_AVATARS[idx % FALLBACK_AVATARS.length];

              return (
                <div
                  key={`${testimonial.id}-${idx}`}
                  className="w-[320px] md:w-[400px] shrink-0 px-4"
                >
                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 h-full flex flex-col gap-6 relative group transition-transform duration-300 hover:-translate-y-2">
                    {/* Decorative Quote */}
                    <Quote className="absolute top-6 right-6 w-12 h-12 text-slate-100 -z-0 rotate-12 group-hover:text-orange-50 transition-colors duration-300" />

                    {/* Product Image */}
                    {testimonial.productImage && (
                      <div className="w-full h-40 rounded-2xl overflow-hidden relative z-10">
                        <img
                          src={testimonial.productImage}
                          alt="Product"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                    )}

                    {/* Stars + Review */}
                    <div className="relative z-10 flex-grow flex flex-col gap-4">
                      <div className="flex gap-1">
                        {Array.from({ length: testimonial.rating ?? 5 }).map((_, s) => (
                          <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-slate-600 italic leading-relaxed text-sm md:text-base">
                        &ldquo;{testimonial.content}&rdquo;
                      </p>
                    </div>

                    {/* Customer */}
                    <div className="flex items-center gap-4 pt-4 border-t border-slate-100 relative z-10">
                      <img
                        src={avatarSrc}
                        alt={testimonial.author_name}
                        className="w-12 h-12 rounded-full border-2 border-orange-200 shadow-sm object-cover"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-blue-950 text-sm">
                          {testimonial.author_name ?? 'Customer'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">Verified Customer</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Testimonials;
