"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { updateCart, fetchActiveCart } from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext();
const GUEST_KEY = 'scs_guest_cart_v1';
const SYNC_DELAY_MS = 400;

function readGuestCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && i.id && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items) {
  try {
    if (items.length) localStorage.setItem(GUEST_KEY, JSON.stringify(items));
    else localStorage.removeItem(GUEST_KEY);
  } catch {}
}

/** Snapshot of a product for showing in the cart before the server confirms prices. */
function toCartLine(product, quantity) {
  const priceValue = Number(product.price_value ?? product.priceValue ?? 0);
  const discount = Number(product.discount || 0);
  return {
    id: String(product.id),
    name: product.name,
    image: product.image || product.primary_image || null,
    price: product.sale_price ?? product.salePrice ?? Math.round(priceValue * (1 - discount / 100)),
    mrp: priceValue,
    stock: Number(product.stock ?? 99),
    quantity,
  };
}

/**
 * Cart works for guests too (stored in this browser) and is merged into the
 * account cart on login. For logged-in users the server is the source of
 * truth: it re-prices every line and clamps quantities to live stock.
 */
export const CartProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');

  const syncTimer = useRef(null);
  const pendingSync = useRef(null);

  const applyServerCart = useCallback((serverCart, requested) => {
    const items = serverCart?.items || [];
    setCart(items);
    if (requested) {
      const changed = requested.some((r) => {
        const s = items.find((i) => i.id === r.id);
        return !s || s.quantity !== r.quantity;
      });
      if (changed) setNotice('Some items were updated to match available stock.');
    }
  }, []);

  // Load cart (and merge guest cart) whenever auth state settles.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      if (!isAuthenticated) {
        setCart(readGuestCart());
        setIsReady(true);
        return;
      }
      try {
        const serverCart = await fetchActiveCart();
        const guest = readGuestCart();
        if (guest.length) {
          const merged = new Map((serverCart?.items || []).map((i) => [i.id, i.quantity]));
          for (const g of guest) merged.set(g.id, (merged.get(g.id) || 0) + g.quantity);
          const payload = [...merged].map(([product, quantity]) => ({ product, quantity }));
          const updated = await updateCart(null, { items: payload });
          writeGuestCart([]);
          if (!cancelled) applyServerCart(updated);
        } else if (!cancelled) {
          applyServerCart(serverCart);
        }
      } catch (err) {
        console.error('Cart load failed:', err);
        if (!cancelled) setCart([]);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, applyServerCart]);

  const scheduleSync = useCallback(
    (nextCart) => {
      if (!isAuthenticated) {
        writeGuestCart(nextCart);
        return;
      }
      pendingSync.current = nextCart;
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(async () => {
        const requested = pendingSync.current;
        pendingSync.current = null;
        setSyncing(true);
        try {
          const updated = await updateCart(null, {
            items: requested.map((i) => ({ product: i.id, quantity: i.quantity })),
          });
          if (!pendingSync.current) applyServerCart(updated, requested);
        } catch (err) {
          console.error('Cart sync failed:', err);
        } finally {
          setSyncing(false);
        }
      }, SYNC_DELAY_MS);
    },
    [isAuthenticated, applyServerCart]
  );

  const mutate = (fn) => {
    setCart((prev) => {
      const next = fn(prev);
      scheduleSync(next);
      return next;
    });
  };

  const addToCart = (product, quantity = 1, { open = true } = {}) => {
    if (!product?.id) return;
    const id = String(product.id);
    const stock = Number(product.stock ?? 99);
    if (stock < 1) return;
    mutate((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, quantity: Math.min(stock, i.quantity + quantity, 20) } : i));
      }
      return [...prev, toCartLine(product, Math.min(stock, quantity, 20))];
    });
    if (open) setIsCartOpen(true);
  };

  const removeFromCart = (productId) => mutate((prev) => prev.filter((i) => i.id !== productId));

  const updateQuantity = (productId, delta) =>
    mutate((prev) =>
      prev.map((i) => {
        if (i.id !== productId) return i;
        const max = Math.min(20, Number(i.stock ?? 20) || 20);
        return { ...i, quantity: Math.max(1, Math.min(max, i.quantity + delta)) };
      })
    );

  /** Local-only clear — the server empties the cart itself when an order is placed. */
  const clearCart = () => {
    setCart([]);
    writeGuestCart([]);
  };

  const toggleCart = () => setIsCartOpen((o) => !o);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + Number(i.price || 0) * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        toggleCart,
        cartCount,
        cartTotal,
        isReady,
        syncing,
        notice,
        clearNotice: () => setNotice(''),
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
