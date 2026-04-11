"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCart, createCart, updateCart } from '../lib/api';

const CartContext = createContext();

/**
 * Normalise a product before adding to cart.
 * Handles both old static-JSON shape and new API shape.
 */
function normaliseCartProduct(product) {
  return {
    ...product,
    // Image: prefer explicit image field, fall back to img (API), then null
    image: product.image || product.img || null,
    // Numeric price for arithmetic: prefer price_value, then parse price string
    priceValue:
      product.price_value ??
      product.priceValue ??
      parseFloat(String(product.price ?? "0").replace(/[^\d.]/g, "")) ??
      0,
  };
}

import { useAuth } from './AuthContext';
import { useRouter } from 'next/navigation';

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [cartId, setCartId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // 1. Initialise session and load backend cart
  useEffect(() => {
    let sid = localStorage.getItem('soulcraft_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('soulcraft_session_id', sid);
    }
    setSessionId(sid);

    fetchCart(sid).then((beCart) => {
      if (beCart) {
        setCartId(beCart.id || beCart._id);
        setCart(beCart.items || []);
        setIsReady(true);
      } else {
        createCart({ session_id: sid, items: [], total_amount: 0 }).then((newCart) => {
          setCartId(newCart.id || newCart._id);
          setIsReady(true);
        }).catch(() => setIsReady(true));
      }
    }).catch(() => setIsReady(true));
  }, []);

  // 2. Sync cart to backend on change (debounced implicitly by natural user actions)
  // We use calculate total synchronously for the payload
  useEffect(() => {
    if (!isReady || !cartId) return;
    const totalAmount = cart.reduce(
        (sum, item) => sum + (item.priceValue ?? item.price ?? 0) * item.quantity,
        0
    );
    updateCart(cartId, { items: cart, total_amount: totalAmount }).catch(console.error);
  }, [cart, isReady, cartId]);

  const addToCart = (product) => {
    if (!isAuthenticated) {
      // Redirect to login with current path as redirect param
      const path = typeof window !== 'undefined' ? window.location.pathname : '/shop';
      router.push(`/login?redirect=${path}`);
      return;
    }

    const norm = normaliseCartProduct(product);
    setCart((prev) => {
      const existing = prev.find((item) => item.id === norm.id);
      if (existing) {
        return prev.map((item) =>
          item.id === norm.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...norm, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, amount) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQty = Math.max(1, item.quantity + amount);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleCart = () => setIsCartOpen((o) => !o);

  /** Total item count across all cart lines */
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Monetary total — uses priceValue (numeric) so it works with both
   * static JSON products (numeric price) and API products (price_value).
   */
  const cartTotal = cart.reduce(
    (sum, item) => sum + (item.priceValue ?? item.price ?? 0) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        toggleCart,
        cartCount,
        cartTotal,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

