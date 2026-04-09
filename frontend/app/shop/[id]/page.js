"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import itemsData from '../../../data/items.json';
import Link from 'next/link';
import { useCart } from '../../../context/CartContext';

const ProductDetailPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState('');

  const handleBuyNow = () => {
    if (product) {
      addToCart(product);
      router.push('/checkout');
    }
  };

  useEffect(() => {
    const foundProduct = itemsData.products.find(p => p.id === parseInt(id));
    if (foundProduct) {
      setProduct(foundProduct);
      setActiveImage(foundProduct.image);
    }
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-8 md:py-24">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 mb-8 md:mb-12 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Link href="/" className="hover:text-orange-500 transition-colors">Home</Link>
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3" /></svg>
          <Link href="/shop" className="hover:text-orange-500 transition-colors">Shop</Link>
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3" /></svg>
          <span className="text-slate-900 truncate max-w-[150px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 xl:gap-24 items-start">
          {/* Left Column: Image Gallery */}
          <div className="flex flex-col gap-4 md:gap-6">
            <div className="aspect-square md:aspect-[4/5] relative rounded-[32px] md:rounded-[40px] overflow-hidden bg-slate-50 border border-slate-100 shadow-sm">
              <img
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.tag && (
                <div className="absolute top-4 left-4 md:top-8 md:left-8 z-10 px-3 py-1.5 md:px-4 md:py-2 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-blue-950 shadow-sm border border-slate-100">
                  {product.tag}
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {product.images?.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`flex-shrink-0 w-20 md:w-24 aspect-square rounded-xl md:rounded-2xl overflow-hidden border-2 transition-all ${
                    activeImage === img ? 'border-orange-500 scale-95' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`${product.name} thumbnail ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="flex flex-col gap-6 md:gap-8 lg:sticky lg:top-32">
            <div className="flex flex-col gap-3 md:gap-4">
              <span className="text-orange-600 font-extrabold tracking-widest uppercase text-[10px] md:text-xs">
                {itemsData.categories.find(c => c.id === product.category)?.name}
              </span>
              <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                {product.name}
              </h1>
              <p className="text-2xl md:text-3xl font-black text-blue-600 font-sans">
                ₹{product.price}
              </p>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            <div className="flex flex-col gap-4 md:gap-6">
              <p className="text-slate-500 text-base md:text-lg leading-relaxed font-sans">
                {product.description}
              </p>
              
              {product.details && (
                <div className="bg-slate-50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100">
                  <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Specifications</h4>
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
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 md:gap-4 mt-2">
              <div className="flex gap-3 md:gap-4">
                <button 
                  onClick={handleBuyNow}
                  className="flex-grow bg-blue-600 text-white py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
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
                onClick={() => addToCart(product)}
                className="w-full border-2 border-blue-600 text-blue-600 py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm hover:bg-blue-50 transition-all"
              >
                Add to Cart
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Handmade</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Fast Ship</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
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
