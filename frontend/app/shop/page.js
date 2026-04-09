"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import itemsData from '../../data/items.json';
import Link from 'next/link';
import Image from 'next/image';

const ShopPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    setProducts(itemsData.products);
    setCategories(itemsData.categories);
    setFilteredProducts(itemsData.products);
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p.category === selectedCategory));
    }
  }, [selectedCategory, products]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-12 md:py-20">
        {/* Header Section */}
        <div className="text-center mb-16 flex flex-col gap-4">
          <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">Discover Our Collection</span>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 mb-6">
            Soul Craft <span className="text-blue-600">Shop.</span>
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg font-sans">
            Explore our complete collection of handcrafted wool art, apparel, and decorations. Each piece is made with love and attention to detail.
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

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="group flex flex-col gap-6 w-full"
            >
              {/* Image Container - Focused */}
              <Link href={`/shop/${product.id}`} className="block aspect-square relative rounded-[32px] overflow-hidden bg-white border border-slate-100 group-hover:shadow-xl transition-all duration-500">
                {product.tag && (
                  <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-blue-950 shadow-sm border border-slate-100">
                    {product.tag}
                  </div>
                )}
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </Link>

              {/* Product Info & Actions Below Image */}
              <div className="flex flex-col gap-2 px-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight group-hover:text-orange-500 transition-colors truncate pr-2">
                    <Link href={`/shop/${product.id}`}>{product.name}</Link>
                  </h3>
                  <span className="text-base font-black text-slate-400 font-sans">
                    ₹{product.price}
                  </span>
                </div>
                
                {/* Action Row */}
                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100">
                  <div className="flex gap-4">
                    {/* Quick Save */}
                    <button 
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      Save Item
                    </button>
                  </div>

                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    {categories.find(c => c.id === product.category)?.name?.split(' ')[0]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 00-2 2H6a2 2 0 00-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No products found</h3>
            <p className="text-slate-500">We couldn't find any products in this category.</p>
          </div>
        )}
      </main>

      <Footer />

      {/* Modern CSS for glassmorphism and animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .product-card {
          animation: fadeIn 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ShopPage;
