"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import siteData from '../data/siteData.json';
import { useCart } from '../context/CartContext';
import CartSheet from './CartSheet';
import { ShoppingBag } from 'lucide-react';

const Navbar = () => {
  const { brand } = siteData;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { toggleCart, cartCount } = useCart();

  return (
    <>
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-orange-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-14 h-14 bg-transparent">
              <img src="/logo.png" alt="SCS Logo" className="w-full h-full object-contain mix-blend-multiply" />
            </div>
            <div className="flex flex-col -gap-1">
              <span className="font-[family-name:var(--font-climate-crisis)] uppercase text-xl text-blue-950 tracking-wider">
                Soul Craft
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">
                Studio
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-8 text-sm font-semibold text-slate-500">
          <Link href="/shop" className="hover:text-orange-500 transition-colors">Shop</Link>
          <Link href="/orders" className="hover:text-orange-500 transition-colors">My Order</Link>
          <Link href="/contact" className="hover:text-orange-500 transition-colors">Contact</Link>
        </nav>

        <div className="flex items-center gap-4">
          {/* Cart Trigger */}
          <button 
            onClick={toggleCart}
            className="relative p-2.5 text-slate-600 hover:text-orange-500 transition-all hover:bg-orange-50 rounded-full group"
          >
            <ShoppingBag className="w-6 h-6 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-orange-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-in zoom-in duration-300">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-slate-600 hover:text-orange-500 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 w-full bg-white border-b border-orange-100 shadow-xl py-6 px-6 flex flex-col gap-6 md:hidden animate-in slide-in-from-top-4 duration-300">
            <nav className="flex flex-col gap-6 text-lg font-semibold text-slate-600">
              <Link href="/shop" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">Shop</Link>
              <Link href="/orders" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">My Order</Link>
              <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">Contact</Link>
            </nav>
          </div>
        )}
      </header>
      
      {/* Cart Sheet - Outside header to ensure full viewport height and fix positioning */}
      <CartSheet />
    </>
  );
};

export default Navbar;
