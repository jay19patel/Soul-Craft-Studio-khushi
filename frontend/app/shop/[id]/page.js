"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import Link from 'next/link';
import { useCart } from '../../../context/CartContext';
import { getProduct, getCategories, normalizeProduct } from '../../../lib/api';

const ProductDetailPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeImage, setActiveImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([getProduct(id), getCategories()])
      .then(([raw, cats]) => {
        const norm = normalizeProduct(raw);
        setProduct(norm);
        setActiveImage(norm?.image || '');
        setCategories(cats);
      })
      .catch((err) => setError(err.message || 'Product not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToCart(product);
    router.push('/checkout');
  };

  // ── Loading skeleton ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-8 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-pulse">
            <div className="aspect-square rounded-[40px] bg-slate-100" />
            <div className="flex flex-col gap-6">
              <div className="h-3 bg-slate-100 rounded-full w-24" />
              <div className="h-10 bg-slate-100 rounded-2xl w-3/4" />
              <div className="h-8 bg-slate-100 rounded-full w-32" />
              <div className="h-px bg-slate-100" />
              <div className="h-4 bg-slate-100 rounded-full w-full" />
              <div className="h-4 bg-slate-100 rounded-full w-4/5" />
              <div className="h-4 bg-slate-100 rounded-full w-2/3" />
              <div className="h-14 bg-slate-100 rounded-full mt-4" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Error / not found ──────────────────────────────────────────────────
  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center gap-6 text-center px-4">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
            Product Not Found
          </h1>
          <p className="text-slate-500 max-w-sm">{error || 'This product does not exist or has been removed.'}</p>
          <Link
            href="/shop"
            className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            Back to Shop
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const categoryName = categories.find((c) => c.id === product.category_id)?.name ?? '';

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-8 md:py-24">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 mb-8 md:mb-12 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Link href="/" className="hover:text-orange-500 transition-colors">Home</Link>
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeWidth="3" />
          </svg>
          <Link href="/shop" className="hover:text-orange-500 transition-colors">Shop</Link>
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeWidth="3" />
          </svg>
          <span className="text-slate-900 truncate max-w-[150px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 xl:gap-24 items-start">
          {/* Left — Image Gallery */}
          <div className="flex flex-col gap-4 md:gap-6">
            <div className="aspect-square md:aspect-[4/5] relative rounded-[32px] md:rounded-[40px] overflow-hidden bg-slate-50 border border-slate-100 shadow-sm">
              {activeImage ? (
                <img src={activeImage} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                  <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {product.tag && (
                <div className="absolute top-4 left-4 md:top-8 md:left-8 z-10 px-3 py-1.5 md:px-4 md:py-2 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-blue-950 shadow-sm border border-slate-100">
                  {product.tag}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images?.length > 1 && (
              <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(img)}
                    className={`flex-shrink-0 w-20 md:w-24 aspect-square rounded-xl md:rounded-2xl overflow-hidden border-2 transition-all ${
                      activeImage === img ? 'border-orange-500 scale-95' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${product.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right — Details */}
          <div className="flex flex-col gap-6 md:gap-8 lg:sticky lg:top-32">
            <div className="flex flex-col gap-3 md:gap-4">
              {categoryName && (
                <span className="text-orange-600 font-extrabold tracking-widest uppercase text-[10px] md:text-xs">
                  {categoryName}
                </span>
              )}
              <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                {product.name}
              </h1>
              <p className="text-2xl md:text-3xl font-black text-blue-600 font-sans">
                {product.priceDisplay}
              </p>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            <div className="flex flex-col gap-4 md:gap-6">
              {product.description && (
                <p className="text-slate-500 text-base md:text-lg leading-relaxed font-sans">
                  {product.description}
                </p>
              )}

              {product.details && (
                <div className="bg-slate-50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100">
                  <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    Specifications
                  </h4>
                  <div className="text-xs md:text-sm text-slate-600 leading-loose flex flex-col gap-2">
                    {product.details.split(',').map((detail, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-orange-400 rounded-full flex-shrink-0" />
                        {detail.trim()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  product.stock > 5
                    ? 'bg-green-50 text-green-600'
                    : product.stock > 0
                    ? 'bg-orange-50 text-orange-600'
                    : 'bg-red-50 text-red-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    product.stock > 5 ? 'bg-green-500' : product.stock > 0 ? 'bg-orange-400' : 'bg-red-400'
                  }`} />
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 md:gap-4 mt-2">
              <div className="flex gap-3 md:gap-4">
                <button
                  onClick={handleBuyNow}
                  disabled={product.stock === 0}
                  className="flex-grow bg-blue-600 text-white py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Buy Now
                </button>
                <button className="p-4 md:p-5 border-2 border-slate-100 rounded-full text-slate-400 hover:text-orange-500 hover:border-orange-100 hover:bg-orange-50 transition-all group">
                  <svg className="w-5 h-5 md:w-6 md:h-6 group-hover:fill-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className={`w-full border-2 py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  addedToCart
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-blue-600 text-blue-600 hover:bg-blue-50'
                }`}
              >
                {addedToCart ? '✓ Added to Cart' : 'Add to Cart'}
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Handmade</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Fast Ship</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetailPage;
