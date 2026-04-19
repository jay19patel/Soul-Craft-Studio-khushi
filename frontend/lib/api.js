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

/** Matches FastAPI ``app.include_router(shop_router, prefix="/api/shop")``. */
const SHOP_API_PREFIX = "/shop";

/**
 * Turn FastAPI ``detail`` (string, object, or validation array) into a readable message.
 */
function formatApiErrorDetail(detail) {
  if (detail == null || detail === "") return "";
  if (typeof detail === "string") return detail;
  if (typeof detail === "number" || typeof detail === "boolean") return String(detail);
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (entry == null) return "";
        if (typeof entry === "string") return entry;
        if (typeof entry === "object" && entry.msg) return String(entry.msg);
        try {
          return JSON.stringify(entry);
        } catch {
          return "[unserializable]";
        }
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "object") {
    if (detail.msg) return String(detail.msg);
    if (detail.message) return String(detail.message);
    if (detail.error) return String(detail.error);
    try {
      return JSON.stringify(detail);
    } catch {
      return "Request failed";
    }
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return "Request failed";
  }
}

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
        const rawDetail =
          body?.detail ?? body?.message ?? body?.error ?? (typeof body === "object" ? body : null);
        const formatted = formatApiErrorDetail(rawDetail);
        errorMessage =
          (formatted && formatted !== "{}" && formatted !== "null" ? formatted : "") || errorMessage;
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
  const data = await apiFetch(`${SHOP_API_PREFIX}/categories/${buildQuery({ page_size: 100 })}`);
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
  return apiFetch(`${SHOP_API_PREFIX}/products/${buildQuery({ page_size: 50, ...params })}`);
}

/**
 * Fetch a single product by its MongoDB ObjectId string.
 */
export async function getProduct(id) {
  return apiFetch(`${SHOP_API_PREFIX}/products/${id}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Place a new order.
 */
export async function createOrder(payload) {
  return apiFetch(`${SHOP_API_PREFIX}/orders/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch a single order by its MongoDB ObjectId string.
 */
export async function getOrder(id) {
  return apiFetch(`${SHOP_API_PREFIX}/orders/${id}`);
}

/**
 * Fetch current user's orders (authenticated).
 */
export async function getMyOrders(params = {}) {
  const data = await apiFetch(`${SHOP_API_PREFIX}/orders/${buildQuery({
    page_size: 50,
    sort: "-created_at",
    ...params
  })}`);
  return (data?.results ?? []).map(normalizeOrder);
}

/**
 * Fetch all orders for a customer email (guest checkout lookup).
 */
/**
 * Fetch orders. If no email is provided, the backend scopes to the current logged-in user.
 */
export async function getOrders(email = null, params = {}) {
  const queryObj = {
    page_size: 100,
    sort: "-created_at",
    ...params,
  };
  if (email) queryObj.customer_email = email;

  const data = await apiFetch(
    `${SHOP_API_PREFIX}/orders/${buildQuery(queryObj)}`
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
 * Log out: invalidate the server session (clears the HTTP-only refresh-token cookie)
 * then wipe client-side storage.
 */
export async function logout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Session may already be expired — still clear local state below.
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_data");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch all payments for the current user.
 */
export async function getPayments(params = {}) {
  const data = await apiFetch(`${SHOP_API_PREFIX}/payments/${buildQuery({
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
  const data = await apiFetch(`${SHOP_API_PREFIX}/carts/${buildQuery(params)}`);
  if (data?.results?.length > 0) {
    return normalizeCart(data.results[0]);
  }
  return null;
}

/**
 * Fetch the current user's open cart (requires authenticated API).
 */
export async function fetchActiveCart() {
  return fetchCart();
}

/**
 * Upload a payment screenshot to get an Attachment ID.
 */
export async function uploadScreenshot(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch(`${SHOP_API_PREFIX}/upload-screenshot`, {
    method: "POST",
    body: formData, // apiFetch handles setting Content-Type for FormData
  });
}

export async function createCart(payload) {
  return apiFetch(`${SHOP_API_PREFIX}/carts/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCart(cartId, payload) {
  const data = await apiFetch(`${SHOP_API_PREFIX}/carts/${cartId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeCart(data);
}

// ═══════════════════════════════════════════════════════════════════════════
// FIELD NORMALISATION HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Shared helper to resolve backend image paths/attachments into full URLs.
 */
function resolveImageUrl(val) {
  if (!val) return null;
  if (typeof val === "string") {
    // Prefix relative paths (e.g., /media/...) with MEDIA_BASE
    return val.startsWith("/") ? `${MEDIA_BASE}${val}` : val;
  }
  // Handle Beanie Attachment objects/links if they were serialized as objects
  const path = val.file_path || val.url || null;
  if (path && typeof path === "string" && path.startsWith("/")) {
    return `${MEDIA_BASE}${path}`;
  }
  return path;
}

/**
 * Normalise a raw backend category object.
 */
export function normalizeCategory(c) {
  if (!c) return null;

  const imageUrl = resolveImageUrl(c.image_url) || resolveImageUrl(c.img);

  return {
    ...c,
    id: String(c.id || c._id || ""),
    img: imageUrl,
    image: imageUrl,
    image_url: imageUrl,
  };
}

/**
 * Normalise a raw backend product object to the shape the frontend expects.
 */
export function normalizeProduct(p) {
  if (!p) return null;

  const galleryFromAttachments = Array.isArray(p.gallery_images)
    ? p.gallery_images.map(resolveImageUrl).filter(Boolean)
    : [];

  const mainImage =
    resolveImageUrl(p.primary_image) ||
    resolveImageUrl(p.image_url) ||
    resolveImageUrl(p.img || p.image);

  const legacyGallery = Array.isArray(p.gallery_image_urls)
    ? p.gallery_image_urls.map(resolveImageUrl).filter(Boolean)
    : [];

  const productId = String(p.id || p._id || "");

  const mergedGallery = [...galleryFromAttachments, ...legacyGallery].filter(Boolean);

  return {
    ...p,
    id: productId,
    image: mainImage,
    images: mergedGallery.length ? mergedGallery : mainImage ? [mainImage] : [],
    priceValue: p.price_value ?? 0,
    priceDisplay: p.price || `₹${p.price_value ?? 0}`,
  };
}

/**
 * Normalise a raw backend order object.
 */
export function normalizeOrder(o) {
  if (!o) return null;
  const orderId = String(o.id || o._id || "");
  return {
    ...o,
    id: orderId,
    date: o.created_at ? new Date(o.created_at).toLocaleString("en-IN") : "",
    items: (o.items || []).map((item) => ({
      ...item,
      image: resolveImageUrl(item.image),
    })),
  };
}

/**
 * Normalise a raw backend cart object.
 */
export function normalizeCart(c) {
  if (!c) return null;
  return {
    ...c,
    id: String(c.id || c._id || ""),
    items: (c.items || []).map((item) => ({
      ...item,
      id: String(item.id || item._id || ""),
      image: resolveImageUrl(item.image) || (item.product ? (resolveImageUrl(item.product.primary_image) || resolveImageUrl(item.product.image_url)) : null),
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
