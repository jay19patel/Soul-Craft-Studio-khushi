"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import CartSheet from './CartSheet';
import {
  ShoppingBag, User as UserIcon, LogOut, Package, ChevronDown, Menu, X, LayoutDashboard, Store, Mail, Home,
} from 'lucide-react';

const Navbar = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { toggleCart, cartCount, isReady: cartReady } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const announcement = settings.home?.announcement;

  // Close menus on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  }

  // Lock page scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const navLink = (href, label) => (
    <Link
      href={href}
      className={`transition-colors ${pathname === href || (href !== '/' && pathname?.startsWith(href)) ? 'text-orange-600' : 'hover:text-orange-500'}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      {announcement && (
        <div className="w-full bg-blue-950 text-white text-center text-[11px] md:text-xs font-bold tracking-wide px-4 py-2">
          {announcement}
        </div>
      )}
      <header className="w-full px-4 md:px-6 py-3 flex items-center justify-between border-b border-orange-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-11 h-11 md:w-14 md:h-14 shrink-0">
            <img src="/logo.png" alt="" className="w-full h-full object-contain mix-blend-multiply" />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-[family-name:var(--font-climate-crisis)] uppercase text-base md:text-xl text-blue-950 tracking-wider truncate">
              Soul Craft
            </span>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mt-1">Studio</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
          {navLink('/', 'Home')}
          {navLink('/shop', 'Shop')}
          {navLink('/contact', 'Contact')}
          {isAuthenticated && user?.is_superuser && (
            <Link href="/admin/dashboard" className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors">Admin</Link>
          )}

          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 py-2 px-4 rounded-full bg-slate-50 hover:bg-orange-50 text-blue-950 transition-all border border-slate-100"
                aria-expanded={isProfileOpen}
              >
                <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <UserIcon className="w-3.5 h-3.5 text-orange-600" />
                </span>
                <span className="max-w-[100px] truncate">{user.full_name?.split(' ')[0] || 'Account'}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => setIsProfileOpen(false)} />
                  <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 p-2 flex flex-col gap-1 z-10">
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 text-slate-600 hover:text-blue-950">
                      <UserIcon className="w-4 h-4" />
                      <span className="text-sm font-bold">My Account</span>
                    </Link>
                    <Link href="/orders" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 text-slate-600 hover:text-blue-950">
                      <Package className="w-4 h-4" />
                      <span className="text-sm font-bold">My Orders</span>
                    </Link>
                    <div className="h-px bg-slate-100 mx-2" />
                    <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 text-red-400 hover:text-red-600">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-bold">Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname || '/')}`}
              className="px-6 py-2.5 bg-blue-950 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 active:scale-95"
            >
              Login
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1 md:gap-4">
          <button
            onClick={toggleCart}
            className="relative p-2.5 text-slate-600 hover:text-orange-500 transition-all hover:bg-orange-50 rounded-full"
            aria-label={`Open cart${cartCount ? `, ${cartCount} items` : ''}`}
          >
            <ShoppingBag className="w-6 h-6" strokeWidth={1.5} />
            {cartReady && cartCount > 0 && (
              <span className="absolute top-1 right-1 min-w-5 h-5 px-1 bg-orange-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>

          <button
            className="md:hidden p-2.5 text-slate-700 hover:text-orange-500 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full inset-x-0 h-[calc(100dvh-4.5rem)] bg-white z-40 overflow-y-auto border-t border-orange-100 shadow-xl">
            <nav className="flex flex-col p-4 gap-1 text-base font-bold text-slate-800">
              {isAuthenticated && (
                <div className="px-4 py-3 mb-2 rounded-2xl bg-orange-50 text-sm">
                  <span className="text-slate-500 font-medium">Hi, </span>
                  <span className="text-blue-950">{user.full_name || user.email}</span>
                </div>
              )}
              <MobileLink href="/" icon={Home} label="Home" />
              <MobileLink href="/shop" icon={Store} label="Shop" />
              {isAuthenticated && <MobileLink href="/orders" icon={Package} label="My Orders" />}
              {isAuthenticated && <MobileLink href="/profile" icon={UserIcon} label="My Account" />}
              <MobileLink href="/contact" icon={Mail} label="Contact" />
              {isAuthenticated && user?.is_superuser && (
                <MobileLink href="/admin/dashboard" icon={LayoutDashboard} label="Admin Panel" className="text-indigo-600" />
              )}
              <div className="mt-4 px-2">
                {!isAuthenticated ? (
                  <Link
                    href={`/login?redirect=${encodeURIComponent(pathname || '/')}`}
                    className="block w-full py-4 bg-blue-950 text-white rounded-2xl text-center font-black uppercase tracking-widest text-sm"
                  >
                    Login / Sign up
                  </Link>
                ) : (
                  <button onClick={logout} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl text-center font-black uppercase tracking-widest text-sm">
                    Logout
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <CartSheet />
    </>
  );
};

function MobileLink({ href, icon: Icon, label, className = '' }) {
  return (
    <Link href={href} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-orange-50 active:bg-orange-100 transition-colors ${className}`}>
      <Icon className="w-5 h-5 text-orange-500" />
      {label}
    </Link>
  );
}

export default Navbar;
