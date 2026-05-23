'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCategories } from '../lib/api';

// Colour palette rotated per category card
const CARD_COLORS = ['bg-orange-50', 'bg-blue-50', 'bg-slate-50', 'bg-amber-50', 'bg-emerald-50'];

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="categories" className="w-full flex flex-col gap-12 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-4">
          <span className="text-blue-600 font-extrabold tracking-widest uppercase text-sm">Browse Crafts</span>
          <h2 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
            Explore <br /> <span className="text-orange-500">Categories.</span>
          </h2>
        </div>
        <p className="text-slate-500 max-w-sm font-medium">
          Discover the magic of handmade wool art across our diverse collections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-[40px] overflow-hidden animate-pulse">
                <div className="aspect-[4/5] bg-slate-100" />
              </div>
            ))
          : categories.map((cat, idx) => (
              <Link
                href={`/shop?category_id=${cat.id}`}
                key={cat.id}
                className={`group relative rounded-[40px] overflow-hidden ${CARD_COLORS[idx % CARD_COLORS.length]} border border-slate-100 hover:shadow-2xl hover:shadow-slate-200 transition-all duration-500 cursor-pointer`}
              >
                <div className="aspect-[4/5] relative overflow-hidden">
                  {cat.img ? (
                    <img
                      src={cat.img}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                      <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <h3 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-white drop-shadow-md">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-white/80 font-bold mt-1 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                      {cat.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
};

export default Categories;
