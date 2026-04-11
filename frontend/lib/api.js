/**
 * lib/api.js
 * ──────────
 * Central API client for Soul Craft Studio.
 * All pages import from here — never fetch() directly.
 *
 * BASE URL is read from NEXT_PUBLIC_API_URL env var so it works
 * in both dev (localhost:8000) and production without code changes.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ── Low-level fetch wrapper ───────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  
  // Get token from localStorage (if in browser)
  let authHeader = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  const res = await fetch(url, {
    headers: { 
      "Content-Type": "application/json", 
      ...authHeader,
      ...options.headers 
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`;
    try {
      const body = await res.json();
      errorMessage = body?.detail || body?.message || errorMessage;
    } catch {
      // non-JSON error body — keep default message
    }
    throw new Error(errorMessage);
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ── Query string builder ──────────────────────────────────────────────────

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      q.append(k, v);
    }
  }
  const str = q.toString();
  return str ? `?${str}` : "";
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch all categories (unpaginated — typically < 20).
 * @returns {Promise<Array>}
 */
export async function getCategories() {
  const data = await apiFetch(`/categories/${buildQuery({ page_size: 100 })}`);
  return data?.results ?? [];
}

/**
 * Fetch all testimonials for the homepage carousel.
 * @returns {Promise<Array>}
 */
export async function getTestimonials() {
  const data = await apiFetch(`/testimonials/${buildQuery({ page_size: 50 })}`);
  return data?.results ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch a paginated list of products with optional filters.
 */
export async function getProducts(params = {}) {
  return apiFetch(`/products/${buildQuery({ page_size: 50, ...params })}`);
}

/**
 * Fetch a single product by its MongoDB ObjectId string.
 */
export async function getProduct(id) {
  return apiFetch(`/products/${id}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Place a new order.
 */
export async function createOrder(payload) {
  return apiFetch("/orders/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch a single order by its MongoDB ObjectId string.
 */
export async function getOrder(id) {
  return apiFetch(`/orders/${id}`);
}

/**
 * Fetch all orders for a customer email (guest checkout lookup).
 */
export async function getOrdersByEmail(email, params = {}) {
  const data = await apiFetch(
    `/orders/${buildQuery({
      customer_email: email,
      page_size: 100,
      sort: "-created_at",
      ...params,
    })}`
  );
  return data?.results ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register a new user account.
 */
export async function register(data) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Login with email and password.
 */
export async function login(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Handle Google authentication via backend.
 */
export async function googleLogin(code) {
  return apiFetch("/auth/google/login", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/**
 * Fetch current logged-in user details.
 */
export async function getMe() {
  return apiFetch("/auth/me");
}

/**
 * Log out (optional—backend usually just clears cookies or frontend drops token).
 */
export async function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_data");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CARTS
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchCart(sessionId) {
  const data = await apiFetch(`/carts/${buildQuery({ session_id: sessionId })}`);
  if (data?.results?.length > 0) {
    return data.results[0];
  }
  return null;
}

export async function createCart(payload) {
  return apiFetch("/carts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCart(cartId, payload) {
  return apiFetch(`/carts/${cartId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FIELD NORMALISATION HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Normalise a raw backend product object to the shape the frontend expects.
 */
export function normalizeProduct(p) {
  if (!p) return null;

  const getImageUrl = (val) => {
    if (!val) return null;
    if (typeof val === "string") return val;
    return val.file_path || val.url || null;
  };

  const mainImage = getImageUrl(p.img || p.image);
  
  return {
    ...p,
    image: mainImage,
    images: (p.images || []).map(getImageUrl).filter(Boolean),
    priceValue: p.price_value ?? 0,
    priceDisplay: p.price || `₹${p.price_value ?? 0}`,
  };
}

/**
 * Normalise a raw backend order object.
 */
export function normalizeOrder(o) {
  if (!o) return null;
  return {
    ...o,
    date: o.created_at ? new Date(o.created_at).toLocaleString("en-IN") : "",
    items: (o.items || []).map((item) => ({
      ...item,
      image: item.image || null,
    })),
  };
}
