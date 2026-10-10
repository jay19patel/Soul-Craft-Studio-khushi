"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, Package, Tags, Home, Star, Mail, Users, Send, History, Settings, Menu, X, LogOut, Store, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ToastProvider } from '../../components/admin/ui';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/homepage', label: 'Homepage & Videos', icon: Home },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/messages', label: 'Messages', icon: Mail },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/emails', label: 'Email log', icon: Send },
  { href: '/admin/activity', label: 'Activity log', icon: History },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const BOTTOM_TABS = ['/admin/dashboard', '/admin/orders', '/admin/products', '/admin/settings'];

export default function AdminLayout({ children }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (!user?.is_superuser) router.replace('/');
  }, [loading, isAuthenticated, user, router, pathname]);

  // Close the drawer when navigating (state-based so it happens during render).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  if (loading || !user?.is_superuser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);
  const current = NAV.find((n) => isActive(n.href));

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            isActive(href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Icon className="w-[18px] h-[18px]" />
          {label}
        </Link>
      ))}
    </nav>
  );

  const footerLinks = (
    <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-3">
      <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
        <Store className="w-[18px] h-[18px]" /> View store
      </Link>
      <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50">
        <LogOut className="w-[18px] h-[18px]" /> Logout
      </button>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans md:flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-slate-200 p-4 gap-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2 px-2 py-1">
            <img src="/logo.png" alt="" className="w-9 h-9 object-contain mix-blend-multiply" />
            <span className="flex flex-col leading-none">
              <span className="font-black text-slate-900">Soul Craft</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mt-1">Admin panel</span>
            </span>
          </Link>
          <div className="flex-1 overflow-y-auto">{navList}</div>
          {footerLinks}
        </aside>

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setDrawerOpen(true)} className="p-2 -ml-2 text-slate-700" aria-label="Open menu">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-black text-slate-900 text-sm">{current?.label || 'Admin'}</span>
          <Link href="/" className="p-2 -mr-2 text-slate-500" aria-label="View store">
            <Store className="w-5 h-5" />
          </Link>
        </header>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-[120]">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-xs bg-white p-4 flex flex-col gap-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900">Admin panel</span>
                <button onClick={() => setDrawerOpen(false)} className="p-2 -mr-2 text-slate-400" aria-label="Close menu">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{navList}</div>
              {footerLinks}
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 px-4 py-5 md:px-8 md:py-8 pb-24 md:pb-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        {/* Mobile bottom tabs */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-5 pb-safe">
          {NAV.filter((n) => BOTTOM_TABS.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 pt-2 text-[10px] font-bold ${isActive(href) ? 'text-indigo-600' : 'text-slate-500'}`}>
              <Icon className="w-5 h-5" />
              {label.split(' ')[0]}
            </Link>
          ))}
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-0.5 pt-2 text-[10px] font-bold text-slate-500">
            <Menu className="w-5 h-5" />
            More
          </button>
        </nav>
      </div>
    </ToastProvider>
  );
}
