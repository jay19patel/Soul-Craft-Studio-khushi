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
  
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  // 1. Initialise session and load backend cart
  useEffect(() => {
    const initCart = async () => {
      let sid = localStorage.getItem('soulcraft_session_id');
      if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('soulcraft_session_id', sid);
      }
      setSessionId(sid);

      try {
        const userId = user?.id || user?._id;
        let activeCart = await fetchActiveCart(userId, sid);

        if (activeCart) {
          // If we found a cart by session but now we're logged in, link it to user
          if (isAuthenticated && userId && !activeCart.user_id) {
            try {
              activeCart = await updateCart(activeCart.id, { user_id: userId });
            } catch (err) {
              console.warn("Could not link session cart to user (already has one?), fetching user cart instead.");
              activeCart = await fetchActiveCart(userId, null);
            }
          }
          
          setCartId(String(activeCart.id || activeCart._id || ''));
          setCart(activeCart.items || []);
        } else {
          // Create new cart
          const payload = { session_id: sid, items: [], total_amount: 0 };
          if (isAuthenticated && userId) payload.user_id = userId;
          
          const newCart = await createCart(payload);
          setCartId(String(newCart.id || newCart._id || ''));
          setCart([]);
        }
      } catch (err) {
        console.error("Cart initialization failed:", err);
      } finally {
        setIsReady(true);
      }
    };

    initCart();
  }, [isAuthenticated, user]);

  // 2. Sync cart to backend on change
  useEffect(() => {
    if (!isReady || !cartId) return;
    
    const totalAmount = cart.reduce(
        (sum, item) => sum + (item.priceValue ?? item.price ?? 0) * item.quantity,
        0
    );
    
    // Normalise items for API precisely
    const payloadItems = cart.map(item => ({
      product: String(item.product || item.id || item._id || ""),
      name: item.name,
      quantity: item.quantity,
      price: item.priceValue || (typeof item.price === 'string' ? parseFloat(item.price.replace(/[^\d.]/g, '')) : item.price),
      image: item.image
    }));

    // We don't want to trigger sync on every keystroke if possible, 
    // but useEffect dependency on [cart] does this. 
    // For small carts it's fine.
    updateCart(cartId, { items: payloadItems, total_amount: totalAmount }).catch(err => {
        console.error("Cart sync failed:", err);
    });
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
        cartId,
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

