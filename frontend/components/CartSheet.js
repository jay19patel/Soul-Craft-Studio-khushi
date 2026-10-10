"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ShoppingBag, X, Plus, Minus, Trash2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CartSheet = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal, isReady, notice, clearNotice } = useCart();

  const threshold = Number(settings.shipping?.free_shipping_threshold || 0);
  const remainingForFree = threshold > 0 ? Math.max(0, threshold - cartTotal) : 0;

  useEffect(() => {
    if (!isCartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setIsCartOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isCartOpen, setIsCartOpen]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 5000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  const close = () => setIsCartOpen(false);

  const goToCheckout = () => {
    close();
    router.push(isAuthenticated ? '/checkout' : '/login?redirect=/checkout');
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed right-0 inset-y-0 h-[100dvh] w-full sm:max-w-[420px] bg-white shadow-2xl z-[101] flex flex-col"
            role="dialog"
            aria-label="Shopping cart"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Your Cart</h2>
              </div>
              <button onClick={close} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900" aria-label="Close cart">
                <X className="w-6 h-6" />
              </button>
            </div>

            {threshold > 0 && cart.length > 0 && (
              <div className="px-5 py-3 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Truck className="w-4 h-4 shrink-0" />
                {remainingForFree > 0
                  ? <>Add ₹{remainingForFree.toLocaleString('en-IN')} more for free shipping</>
                  : <>You get free shipping on this order 🎉</>}
              </div>
            )}

            {notice && <div className="px-5 py-2.5 bg-amber-50 text-amber-800 text-xs font-bold">{notice}</div>}

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {!isReady ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                  <ShoppingBag className="w-14 h-14 text-slate-200" />
                  <p className="text-slate-500 text-sm">Your cart is empty</p>
                  <Link href="/shop" onClick={close} className="px-6 py-3 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest">
                    Start shopping
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-5">
                  {cart.map((item) => (
                    <li key={item.id} className="flex gap-4">
                      <Link href={`/shop/${item.id}`} onClick={close} className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : null}
                      </Link>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <Link href={`/shop/${item.id}`} onClick={close} className="text-sm font-bold text-blue-950 leading-tight line-clamp-2">
                          {item.name}
                        </Link>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-black text-orange-600">₹{Number(item.price).toLocaleString('en-IN')}</span>
                          {item.mrp > item.price && <span className="text-xs text-slate-400 line-through">₹{Number(item.mrp).toLocaleString('en-IN')}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center bg-slate-100 rounded-xl">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              disabled={item.quantity <= 1}
                              className="w-9 h-9 flex items-center justify-center text-slate-600 disabled:opacity-30"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" strokeWidth={3} />
                            </button>
                            <span className="w-7 text-center text-sm font-black text-blue-950">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              disabled={item.quantity >= Math.min(20, item.stock ?? 20)}
                              className="w-9 h-9 flex items-center justify-center text-slate-600 disabled:opacity-30"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                            </button>
                          </div>
                          <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl" aria-label="Remove item">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {item.stock > 0 && item.stock <= 3 && (
                          <span className="text-[10px] font-bold text-amber-600">Only {item.stock} left</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cart.length > 0 && (
              <div className="px-5 pt-4 pb-safe border-t border-slate-100 bg-white flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Subtotal</span>
                  <span className="font-black text-lg text-blue-950">₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] text-slate-400 -mt-2">Shipping & payment options at checkout</p>
                <button
                  onClick={goToCheckout}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-orange-100 transition-all active:scale-[0.98]"
                >
                  Checkout
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSheet;
