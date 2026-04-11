"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import siteData from '../data/siteData.json';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartSheet from './CartSheet';
import { ShoppingBag, User as UserIcon, LogOut, Package, LogIn, ChevronDown } from 'lucide-react';

const Navbar = () => {
  const { brand } = siteData;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { toggleCart, cartCount } = useCart();
  const { user, logout, isAuthenticated } = useAuth();

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
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
          <Link href="/shop" className="hover:text-orange-500 transition-colors">Shop</Link>
          <Link href="/contact" className="hover:text-orange-500 transition-colors">Contact</Link>
          
          {isAuthenticated ? (
             <div className="relative">
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 py-2 px-4 rounded-full bg-slate-50 hover:bg-orange-50 text-blue-950 transition-all border border-slate-100 group"
                >
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                    <UserIcon className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <span className="max-w-[100px] truncate">{user.full_name?.split(' ')[0] || 'User'}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileOpen && (
                  <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 p-2 flex flex-col gap-1 animate-in zoom-in-95 fade-in duration-200">
                    <Link 
                      href="/orders" 
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 text-slate-600 hover:text-blue-950 transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      <span className="text-sm font-bold">My Orders</span>
                    </Link>
                    <div className="h-px bg-slate-50 mx-2" />
                    <button 
                      onClick={() => { logout(); setIsProfileOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors group"
                    >
                      <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      <span className="text-sm font-bold">Logout</span>
                    </button>
                  </div>
                )}
             </div>
          ) : (
            <Link 
              href="/login" 
              className="px-6 py-2.5 bg-blue-950 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 active:scale-95"
            >
              Login
            </Link>
          )}
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
          <div className="absolute top-full left-0 w-full bg-white border-b border-orange-100 shadow-xl py-8 px-6 flex flex-col gap-8 md:hidden animate-in slide-in-from-top-4 duration-300">
            <nav className="flex flex-col gap-6 text-lg font-bold text-slate-800">
              <Link href="/shop" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 hover:bg-orange-50 rounded-2xl transition-all">Shop</Link>
              <Link href="/orders" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 hover:bg-orange-50 rounded-2xl transition-all">My Order</Link>
              <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 hover:bg-orange-50 rounded-2xl transition-all">Contact</Link>
              
              {!isAuthenticated ? (
                <Link 
                  href="/login" 
                  onClick={() => setIsMenuOpen(false)}
                  className="mx-4 mt-2 py-4 bg-blue-950 text-white rounded-2xl text-center font-black uppercase tracking-widest text-sm"
                >
                  Login
                </Link>
              ) : (
                <button 
                  onClick={() => { logout(); setIsMenuOpen(false); }}
                  className="mx-4 mt-2 py-4 bg-red-50 text-red-500 rounded-2xl text-center font-black uppercase tracking-widest text-sm"
                >
                  Logout
                </button>
              )}
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
