/**
 * lib/api.js
 * ──────────
 * Central API client for Soul Craft Studio.
 * All pages import from here — never fetch() directly.
 *
 * BASE URL is read from NEXT_PUBLIC_API_URL env var so it works
 * in both dev (localhost:8000) and production without code changes.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
export const MEDIA_BASE = API_BASE.includes("/api") ? API_BASE.split("/api")[0] : API_BASE;

// ── Low-level fetch wrapper ───────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  // Defensive check for malformed paths
  if (path.includes("[object Object]")) {
    console.error("apiFetch error: Path contains [object Object]. This is likely due to an object being passed instead of an ID string.", { path });
    throw new Error("Invalid API path: contains [object Object]");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${cleanPath}`;
  
  // Get token from localStorage (if in browser)
  let authHeader = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  try {
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
  } catch (err) {
    console.error(`apiFetch failed for ${url}:`, err);
    throw err;
  }
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
  const results = data?.results ?? [];
  return results.map(normalizeCategory);
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
 * Fetch current user's orders (authenticated).
 */
export async function getMyOrders(params = {}) {
  const data = await apiFetch(`/orders/${buildQuery({
    page_size: 50,
    sort: "-created_at",
    ...params
  })}`);
  return (data?.results ?? []).map(normalizeOrder);
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
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch all payments for the current user.
 */
export async function getPayments(params = {}) {
  const data = await apiFetch(`/payments/${buildQuery({
    page_size: 100,
    sort: "-created_at",
    ...params
  })}`);
  return (data?.results ?? []).map(normalizePayment);
}

// ═══════════════════════════════════════════════════════════════════════════
// CARTS
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchCart(params = {}) {
  const data = await apiFetch(`/carts/${buildQuery(params)}`);
  if (data?.results?.length > 0) {
    return data.results[0];
  }
  return null;
}

/**
 * Smart helper to fetch the ONE active (non-ordered) cart for a user or session.
 */
export async function fetchActiveCart(userId, sessionId) {
  const params = { is_ordered: false };
  if (userId) params.user_id = userId;
  else if (sessionId) params.session_id = sessionId;
  else return null;

  return fetchCart(params);
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
 * Normalise a raw backend category object.
 */
export function normalizeCategory(c) {
  if (!c) return null;

  const getImageUrl = (val) => {
    if (!val) return null;
    if (typeof val === "string") {
      if (val.startsWith("/")) return `${MEDIA_BASE}${val}`;
      return val;
    }
    const path = val.file_path || val.url || null;
    if (path && path.startsWith("/")) {
      return `${MEDIA_BASE}${path}`;
    }
    return path;
  };

  return {
    ...c,
    img: getImageUrl(c.img),
    image: getImageUrl(c.img), // alias for consistency
  };
}

/**
 * Normalise a raw backend product object to the shape the frontend expects.
 */
export function normalizeProduct(p) {
  if (!p) return null;

  const getImageUrl = (val) => {
    if (!val) return null;
    if (typeof val === "string") {
      if (val.startsWith("/")) return `${MEDIA_BASE}${val}`;
      return val;
    }
    const path = val.file_path || val.url || null;
    if (path && path.startsWith("/")) {
      return `${MEDIA_BASE}${path}`;
    }
    return path;
  };

  const mainImage = getImageUrl(p.img || p.image);
  
  // Beanie documents have 'id' (string) or '_id' (PydanticObjectId)
  const productId = String(p.id || p._id || "");

  return {
    ...p,
    id: productId, // Ensure ID is a clean string at the top level
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

/**
 * Normalise a raw backend payment object.
 */
export function normalizePayment(p) {
  if (!p) return null;
  const formatDate = (d) => d ? new Date(d).toLocaleString("en-IN") : null;
  return {
    ...p,
    submittedAt: formatDate(p.submitted_at),
    receivedAt: formatDate(p.received_at),
    confirmedAt: formatDate(p.confirmed_at),
    createdAt: formatDate(p.created_at),
  };
}
