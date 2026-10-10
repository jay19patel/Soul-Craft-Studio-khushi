"use client";

import React from 'react';
import Link from 'next/link';
import siteData from '../data/siteData.json';
import { useSettings } from '../context/SettingsContext';

const Footer = () => {
  const { faqs } = siteData;
  const { settings } = useSettings();
  const store = settings.store || siteData.brand;

  return (
    <footer id="footer" className="w-full py-12 border-t border-slate-200 mt-auto bg-white">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 md:gap-12">
        <div className="flex flex-col gap-5 max-w-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden">
              <img src="/logo.png" alt="" className="w-full h-full object-cover scale-110" />
            </div>
            <div className="flex flex-col">
              <span className="font-[family-name:var(--font-climate-crisis)] uppercase text-xs text-blue-950 tracking-wider">Soul Craft</span>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-500">Studio</span>
            </div>
          </div>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">{(store.tagline || '').split('.')[0]}.</p>
          <div className="flex flex-col gap-1.5 text-sm text-slate-600">
            {store.email && <a href={`mailto:${store.email}`} className="hover:text-orange-600 break-all">{store.email}</a>}
            {store.phone && <a href={`tel:${store.phone.replace(/\s+/g, '')}`} className="hover:text-orange-600">{store.phone}</a>}
            {store.location && <span>{store.location}</span>}
          </div>
        </div>

        <div>
          <h4 className="font-black text-blue-950 uppercase text-xs tracking-widest mb-6">Common Questions</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {faqs.map((faq) => (
              <div key={faq.q} className="flex flex-col gap-2">
                <h5 className="font-bold text-sm leading-tight text-orange-600">{faq.q}</h5>
                <p className="text-slate-500 font-medium text-xs leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2 text-center md:text-left">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            © {new Date().getFullYear()} {store.name}. All rights reserved.
          </p>
          <p className="text-slate-400 font-medium text-[10px] uppercase tracking-[0.2em]">
            Developed by <a href="https://njtechstudio.in" target="_blank" rel="noopener noreferrer" className="text-purple-800 font-black hover:text-orange-500">njtechstudio</a>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-xs font-black uppercase tracking-widest text-slate-400">
          <Link href="/shop" className="hover:text-blue-600">Shop</Link>
          <Link href="/contact" className="hover:text-blue-600">Contact</Link>
          <Link href="/terms" className="hover:text-blue-600">Policies</Link>
          {store.instagram && <a href={store.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">Instagram</a>}
          {store.youtube && <a href={store.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">YouTube</a>}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
