"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { ShoppingBag, X, Plus, Minus, Trash2 } from 'lucide-react';
import Link from 'next/link';

const CartSheet = () => {
    const { 
        cart, 
        isCartOpen, 
        toggleCart, 
        removeFromCart, 
        updateQuantity, 
        cartTotal 
    } = useCart();

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleCart}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                    />

                    {/* Sheet Content */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 inset-y-0 h-screen w-full sm:max-w-[420px] bg-white shadow-2xl z-[101] flex flex-col"
                    >
                        {/* Header - Solid background */}
                        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <ShoppingBag className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg md:text-xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
                                    Your Cart
                                </h2>
                            </div>
                            <button 
                                onClick={toggleCart}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Items List - Scrollable with solid background */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white scrollbar-hide">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50">
                                    <ShoppingBag className="w-12 md:w-16 h-12 md:h-16 text-slate-200" />
                                    <p className="font-sans text-slate-500 text-sm">Your cart is empty</p>
                                    <Link 
                                        href="/shop" 
                                        onClick={toggleCart}
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-orange-500"
                                    >
                                        Start Shopping
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6 md:gap-8">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex gap-4 md:gap-5 group items-start">
                                            {/* Image */}
                                            <div className="w-20 md:w-24 aspect-square rounded-[20px] md:rounded-[24px] overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0 shadow-sm relative">
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                <div className="absolute top-1.5 right-1.5 bg-blue-600 text-white rounded-lg px-1.5 py-0.5 shadow-md">
                                                    <span className="text-[10px] font-black">x{item.quantity}</span>
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-grow flex flex-col gap-2 md:gap-3 py-0.5">
                                                <div className="flex flex-col gap-0.5">
                                                    <h3 className="text-[11px] md:text-[13px] font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                                                        {item.name}
                                                    </h3>
                                                    <span className="text-xs md:text-sm font-black text-blue-600">₹{item.price}</span>
                                                </div>

                                                <div className="flex items-center justify-between mt-2">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center gap-2 md:gap-3 bg-slate-100 rounded-xl px-2 py-1 md:py-1.5 border border-slate-100">
                                                        <button 
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="p-1 hover:text-orange-500 transition-colors bg-white rounded-md shadow-sm"
                                                        >
                                                            <Minus className="w-2.5 h-2.5" strokeWidth={3} />
                                                        </button>
                                                        <span className="text-xs md:text-sm font-black text-blue-950 w-4 md:w-5 text-center">{item.quantity}</span>
                                                        <button 
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="p-1 hover:text-orange-500 transition-colors bg-white rounded-md shadow-sm"
                                                        >
                                                            <Plus className="w-2.5 h-2.5" strokeWidth={3} />
                                                        </button>
                                                    </div>

                                                    {/* Remove Button */}
                                                    <button 
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="p-1.5 md:p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer - Solid background fixed at bottom */}
                        {cart.length > 0 && (
                            <div className="p-6 md:p-8 border-t border-slate-100 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.03)] flex flex-col gap-6 z-10">
                                <div className="flex justify-between items-center text-base md:text-lg">
                                    <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">Total Amount</span>
                                    <span className="font-black text-blue-950">₹{cartTotal}</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <Link 
                                        href="/checkout"
                                        onClick={toggleCart}
                                        className="w-full bg-blue-600 text-white py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-xs md:text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 text-center flex items-center justify-center"
                                    >
                                        Checkout Now
                                    </Link>
                                    <p className="text-[10px] text-center text-slate-400 font-black uppercase tracking-widest">
                                        Secure transaction • Free shipping
                                    </p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CartSheet;
