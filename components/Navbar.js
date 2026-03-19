"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import siteData from '../data/siteData.json';

const Navbar = () => {
  const { brand } = siteData;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="w-full px-6 py-4 flex items-center justify-between border-b border-orange-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-20 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-[family-name:var(--font-climate-crisis)] text-xl shadow-sm shadow-orange-200 text-center leading-none group-hover:scale-110 transition-transform">
            {brand.shortName}
          </div>
          <span className="font-[family-name:var(--font-climate-crisis)] uppercase text-xl text-blue-950 tracking-wider">
            {brand.name}
          </span>
        </Link>
      </div>

      {/* Desktop Nav */}
      <nav className="hidden md:flex gap-8 text-sm font-semibold text-slate-500">
        <Link href="/#categories" className="hover:text-orange-500 transition-colors">Categories</Link>
        <Link href="/#products" className="hover:text-orange-500 transition-colors">Shop</Link>
        <Link href="/#founder" className="hover:text-orange-500 transition-colors">About</Link>
        <Link href="/contact" className="hover:text-orange-500 transition-colors">Contact</Link>
      </nav>

      <div className="flex items-center gap-4">
        <button className="hidden sm:block px-5 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 hover:shadow-blue-300 transform hover:-translate-y-0.5 duration-200">
          Get Notified
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
        <div className="absolute top-full left-0 w-full bg-white border-b border-orange-100 shadow-xl py-6 px-6 flex flex-col gap-6 md:hidden">
          <nav className="flex flex-col gap-6 text-lg font-semibold text-slate-600">
            <Link href="/#categories" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">Categories</Link>
            <Link href="/#products" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">Shop</Link>
            <Link href="/#founder" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">About</Link>
            <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="hover:text-orange-500 transition-colors">Contact</Link>
          </nav>
          <button className="w-full sm:hidden px-5 py-3 text-base font-bold bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
            Get Notified
          </button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
