'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProducts, normalizeProduct } from '../lib/api';

const SkeletonCard = () => (
  <div className="flex flex-col gap-6 animate-pulse">
    <div className="aspect-square rounded-[32px] bg-slate-100" />
    <div className="flex flex-col gap-2 px-2">
      <div className="h-4 bg-slate-100 rounded-full w-3/4" />
      <div className="h-3 bg-slate-100 rounded-full w-1/3" />
    </div>
  </div>
);

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch first 8 products — these are the "featured" ones on homepage
    getProducts({ page_size: 8 })
      .then((data) => setProducts((data?.results ?? []).map(normalizeProduct)))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="products" className="w-full flex flex-col gap-12 py-12">
      <div className="text-center flex flex-col gap-4">
        <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">Our Creations</span>
        <h2 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
          Featured <span className="text-blue-600">Products.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((prod) => (
              <Link
                href={`/shop/${prod.id}`}
                key={prod.id}
                className="flex flex-col gap-6 group"
              >
                <div className="aspect-square relative rounded-[32px] overflow-hidden bg-white border border-slate-100 group-hover:shadow-xl transition-all duration-500">
                  {prod.image ? (
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {prod.tag && (
                    <div className="absolute top-6 left-6 px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-blue-950 shadow-sm border border-slate-100">
                      {prod.tag}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 px-2">
                  <h3 className="text-lg font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight group-hover:text-orange-500 transition-colors">
                    {prod.name}
                  </h3>
                  <p className="text-lg font-black text-slate-400 font-sans">{prod.priceDisplay}</p>
                </div>
              </Link>
            ))}
      </div>

      <div className="flex justify-center mt-8">
        <Link
          href="/shop"
          className="px-10 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-sm rounded-full hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 hover:shadow-blue-200 active:scale-95 group flex items-center gap-3"
        >
          Explore All Products
          <svg className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
};

export default Products;
