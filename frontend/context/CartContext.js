"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createCart, updateCart, fetchActiveCart } from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext();

/**
 * Normalise a product before adding to cart.
 * Handles both old static-JSON shape and new API shape.
 */
function normaliseCartProduct(product) {
  const catalogProductId = String(product.id ?? product._id ?? '');
  return {
    ...product,
    id: catalogProductId,
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

/** Build a stable catalog product id for PATCH payloads (never use cart-line row id here). */
function resolveProductIdForCartLine(line) {
  if (!line) return '';
  if (line.product_id) return String(line.product_id);
  const productRef = line.product;
  if (typeof productRef === 'string') return productRef;
  if (productRef && typeof productRef === 'object') {
    const nestedId =
      productRef.id ??
      productRef._id ??
      productRef.$id ??
      (productRef.$oid != null ? productRef.$oid : '');
    if (nestedId !== '' && nestedId !== undefined && nestedId !== null) {
      return String(nestedId);
    }
  }
  return '';
}

/**
 * API cart lines → in-memory cart rows keyed by catalog product id (for addToCart / sync).
 */
function normalizeCartLinesFromApi(items) {
  if (!Array.isArray(items)) return [];
  return items.map((line) => {
    const productId = resolveProductIdForCartLine(line);
    const embedded = line.product && typeof line.product === 'object' ? line.product : null;
    return {
      id: productId,
      name: line.name || embedded?.name || 'Item',
      priceValue: Number(line.price ?? embedded?.price_value ?? 0),
      price: line.price,
      image:
        line.image ||
        embedded?.primary_image?.file_path ||
        embedded?.image_url ||
        embedded?.image ||
        null,
      quantity: Number(line.quantity ?? 1),
    };
  });
}

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartId, setCartId] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // ? Skip the first sync cycle after the cart is loaded from the server so we
  //   don't immediately PATCH with the same data (which causes the backend to
  //   delete and re-create all CartItem documents for no reason).
  const skipNextSyncRef = React.useRef(false);

  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // 1. Backend cart only after login (JWT). Guests have no server cart.
  useEffect(() => {
    const initCart = async () => {
      if (authLoading) {
        return;
      }

      if (!isAuthenticated || !user) {
        setCart([]);
        setCartId(null);
        setIsReady(true);
        return;
      }

      const userId = user.id || user._id;
      if (!userId) {
        setCart([]);
        setCartId(null);
        setIsReady(true);
        return;
      }

      try {
        let activeCart = await fetchActiveCart();

        if (activeCart) {
          skipNextSyncRef.current = true;
          setCartId(String(activeCart.id || activeCart._id || ''));
          setCart(normalizeCartLinesFromApi(activeCart.items));
        } else {
          const newCart = await createCart({ items: [], total_amount: 0 });
          setCartId(String(newCart.id || newCart._id || ''));
          setCart([]);
        }
      } catch (err) {
        console.error("Cart initialization failed:", err);
        setCart([]);
        setCartId(null);
      } finally {
        setIsReady(true);
      }
    };

    initCart();
  }, [isAuthenticated, user, authLoading]);

  // 2. Sync cart to backend when logged in and a cart id exists.
  //    skipNextSyncRef prevents firing immediately after the server load (which
  //    would delete + recreate every CartItem document with identical data).
  useEffect(() => {
    if (!isAuthenticated || !isReady || !cartId) return;

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const totalAmount = cart.reduce(
      (sum, item) => sum + (item.priceValue ?? item.price ?? 0) * item.quantity,
      0
    );

    const payloadItems = cart
      .map((item) => {
        const productIdFromReference = resolveProductIdForCartLine({
          product_id: item.product_id,
          product: item.product,
        });
        const catalogProductId =
          (productIdFromReference && String(productIdFromReference).trim()) ||
          String(item.id ?? '').trim();
        if (!catalogProductId) {
          return null;
        }
        return {
          product: catalogProductId,
          name: item.name,
          quantity: item.quantity,
          price:
            item.priceValue ??
            (typeof item.price === 'string'
              ? parseFloat(String(item.price).replace(/[^\d.]/g, ''))
              : item.price),
        };
      })
      .filter(Boolean);

    if (cartId) {
      updateCart(cartId, { items: payloadItems, total_amount: totalAmount }).catch((err) => {
        console.error("Cart sync failed:", err);
      });
    }
  }, [cart, isReady, cartId, isAuthenticated]);

  const addToCart = (product) => {
    if (!isAuthenticated) {
      // Redirect to login with current path as redirect param
      const path = typeof window !== 'undefined' ? window.location.pathname : '/shop';
      router.push(`/login?redirect=${path}`);
      return;
    }

    const norm = normaliseCartProduct(product);
    if (!norm.id) {
      console.error("Cannot add to cart: product is missing a stable catalog id.");
      return;
    }
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

