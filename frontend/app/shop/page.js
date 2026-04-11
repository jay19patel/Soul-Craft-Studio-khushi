"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { getProducts, getCategories, normalizeProduct } from '../../lib/api';

// ── Skeleton card shown while loading ─────────────────────────────────────
const SkeletonCard = () => (
  <div className="flex flex-col gap-6 w-full animate-pulse">
    <div className="aspect-square rounded-[32px] bg-slate-100" />
    <div className="flex flex-col gap-2 px-1">
      <div className="h-4 bg-slate-100 rounded-full w-3/4" />
      <div className="h-3 bg-slate-100 rounded-full w-1/3" />
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────
const ShopPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load categories once
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Re-fetch products whenever selected category changes
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedCategory !== 'all') params.category_id = selectedCategory;
      const data = await getProducts(params);
      setProducts((data?.results ?? []).map(normalizeProduct));
    } catch (err) {
      setError(err.message || 'Failed to load products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-16 flex flex-col gap-4">
          <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">
            Discover Our Collection
          </span>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 mb-6">
            Soul Craft <span className="text-blue-600">Shop.</span>
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg font-sans">
            Explore our complete collection of handcrafted wool art, apparel, and
            decorations. Each piece is made with love and attention to detail.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-16 px-4">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all duration-300 ${
              selectedCategory === 'all'
                ? 'bg-orange-500 text-white shadow-xl shadow-orange-100 -translate-y-1'
                : 'bg-white text-slate-600 hover:bg-orange-50 shadow-sm'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all duration-300 ${
                selectedCategory === cat.id
                  ? 'bg-orange-500 text-white shadow-xl shadow-orange-100 -translate-y-1'
                  : 'bg-white text-slate-600 hover:bg-orange-50 shadow-sm'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400 font-bold">{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : products.map((product) => (
                  <div key={product.id} className="group flex flex-col gap-6 w-full">
                    {/* Image */}
                    <Link
                      href={`/shop/${product.id}`}
                      className="block aspect-square relative rounded-[32px] overflow-hidden bg-white border border-slate-100 group-hover:shadow-xl transition-all duration-500"
                    >
                      {product.tag && (
                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-blue-950 shadow-sm border border-slate-100">
                          {product.tag}
                        </div>
                      )}
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <svg
                            className="w-12 h-12 text-slate-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex flex-col gap-2 px-1">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight group-hover:text-orange-500 transition-colors truncate pr-2">
                          <Link href={`/shop/${product.id}`}>{product.name}</Link>
                        </h3>
                        <span className="text-base font-black text-slate-700 font-sans whitespace-nowrap">
                          {product.priceDisplay}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100">
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          {product.stock > 0 ? `${product.stock} left` : 'Out of stock'}
                        </span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          {categories.find((c) => c.id === product.category_id)?.name?.split(' ')[0] ?? ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No products found</h3>
            <p className="text-slate-500">We couldn&apos;t find any products in this category.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ShopPage;
