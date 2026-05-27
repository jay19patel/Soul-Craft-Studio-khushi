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

/** Base prefix for shop API routes. Set to empty string for Django integration. */
const SHOP_API_PREFIX = "";

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
  
  const { requireAuth = true, ...fetchOptions } = options;

  // Get token from localStorage (if in browser)
  let authHeader = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (requireAuth && token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  const isFormData = fetchOptions.body instanceof FormData;
  const headers = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...authHeader,
    ...fetchOptions.headers,
  };

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
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
      const error = new Error(errorMessage);
      error.status = res.status;
      error.url = url;
      if (res.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_data");
      }
      throw error;
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
  const data = await apiFetch(`${SHOP_API_PREFIX}/categories/${buildQuery({ page_size: 100 })}`, {
    requireAuth: false,
  });
  const results = data?.results ?? [];
  return results.map(normalizeCategory);
}

/**
 * Fetch all testimonials for the homepage carousel.
 * @returns {Promise<Array>}
 */
export async function getTestimonials() {
  const data = await apiFetch(`/testimonials/${buildQuery({ page_size: 50 })}`, {
    requireAuth: false,
  });
  return data?.results ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch a paginated list of products with optional filters.
 */
export async function getProducts(params = {}) {
  return apiFetch(`${SHOP_API_PREFIX}/products/${buildQuery({ page_size: 50, ...params })}`, {
    requireAuth: false,
  });
}

/**
 * Fetch a single product by its MongoDB ObjectId string.
 */
export async function getProduct(id) {
  return apiFetch(`${SHOP_API_PREFIX}/products/${id}`, {
    requireAuth: false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Place a new order for the authenticated customer.
 */
export async function createOrder(payload) {
  return apiFetch(`${SHOP_API_PREFIX}/orders/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch one of the authenticated customer's orders.
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
 * Fetch orders belonging to the authenticated customer.
 */
export async function getOrders(email = null, params = {}) {
  const queryObj = {
    page_size: 100,
    sort: "-created_at",
    ...params,
  };
  if (email) queryObj.customer_email = email;

  const data = await apiFetch(`${SHOP_API_PREFIX}/orders/${buildQuery(queryObj)}`);
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
    requireAuth: false,
  });
}

/**
 * Login with email and password.
 */
export async function login(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    requireAuth: false,
  });
}

/**
 * Handle Google authentication via backend.
 */
export async function googleLogin(access_token) {
  // Use dj-rest-auth social login endpoint
  return apiFetch("/auth/google/", {
    method: "POST",
    body: JSON.stringify({ access_token }),
    requireAuth: false,
  });
}

/**
 * Fetch current logged-in user details.
 */
export async function getMe() {
  return apiFetch("/auth/me");
}

/**
 * Update current logged-in user details.
 */
export async function updateProfile(data) {
  return apiFetch("/auth/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
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
  const data = await apiFetch(`${SHOP_API_PREFIX}/carts/${cartId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeCart(data);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════

export async function getAddresses() {
  const data = await apiFetch(`/addresses/`);
  return data?.results ?? data ?? [];
}

export async function addAddress(payload) {
  return apiFetch(`/addresses/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setDefaultAddress(id) {
  return apiFetch(`/addresses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ is_default: true }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACTS
// ═══════════════════════════════════════════════════════════════════════════

export async function getContacts() {
  const data = await apiFetch(`/contacts/`);
  return data?.results ?? data ?? [];
}

export async function addContact(payload) {
  return apiFetch(`/contacts/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setDefaultContact(id) {
  return apiFetch(`/contacts/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ is_default: true }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export async function getAdminStats() {
  return apiFetch(`/admin/stats`);
}

export async function getAdminOrders() {
  const data = await apiFetch(`/admin/orders/`);
  return (data?.results ?? data ?? []).map(normalizeOrder);
}

export async function getAdminOrder(id) {
  const data = await apiFetch(`/admin/orders/${id}/`);
  return normalizeOrder(data);
}

export async function updateAdminOrder(id, payload) {
  return apiFetch(`/admin/orders/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
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
    payment_verified_date: o.payment_verified_at ? new Date(o.payment_verified_at).toLocaleString("en-IN") : null,
    processing_date: o.processing_at ? new Date(o.processing_at).toLocaleString("en-IN") : null,
    shipped_date: o.shipped_at ? new Date(o.shipped_at).toLocaleString("en-IN") : null,
    delivered_date: o.delivered_at ? new Date(o.delivered_at).toLocaleString("en-IN") : null,
    cancelled_date: o.cancelled_at ? new Date(o.cancelled_at).toLocaleString("en-IN") : null,
    screenshot_url: resolveImageUrl(o.screenshot_id),
    items: (o.items || []).map((item) => ({
      ...item,
      name: item.product?.name || item.variant?.product?.name || item.name || "Product",
      image: resolveImageUrl(item.product?.primary_image || item.image || item.variant?.product?.primary_image),
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
    items: (c.items || []).map((item) => {
      const productImage = item.product?.primary_image || null;
      return {
        ...item,
        id: String(item.id || item._id || ""),
        image: resolveImageUrl(item.image) || resolveImageUrl(productImage),
      };
    }),
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

// ==========================================
// ADMIN PRODUCT APIs
// ==========================================

export async function getAdminProducts() {
  const data = await apiFetch('/admin/products/', { requireAuth: true });
  // Handle paginated responses from DRF
  return data.results ? data.results.map(normalizeProduct) : data.map(normalizeProduct);
}

export async function createAdminProduct(productData) {
  const isFormData = productData instanceof FormData;
  return await apiFetch('/admin/products/', {
    method: 'POST',
    body: isFormData ? productData : JSON.stringify(productData),
    requireAuth: true,
  });
}

export async function updateAdminProduct(id, productData) {
  const isFormData = productData instanceof FormData;
  return await apiFetch(`/admin/products/${id}/`, {
    method: 'PATCH',
    body: isFormData ? productData : JSON.stringify(productData),
    requireAuth: true,
  });
}

export async function deleteAdminProduct(id) {
  return await apiFetch(`/admin/products/${id}/`, {
    method: 'DELETE',
    requireAuth: true,
  });
}

// ==========================================
// CONTACT MESSAGE APIs
// ==========================================

export async function submitContactMessage(messageData) {
  return await apiFetch('/contact-messages/', {
    method: 'POST',
    body: JSON.stringify(messageData),
    requireAuth: false,
  });
}

export async function getAdminMessages() {
  const data = await apiFetch('/contact-messages/', { requireAuth: true });
  return data.results ? data.results : data;
}

export async function updateAdminMessage(id, messageData) {
  return await apiFetch(`/contact-messages/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(messageData),
    requireAuth: true,
  });
}

export async function deleteAdminMessage(id) {
  return await apiFetch(`/contact-messages/${id}/`, {
    method: 'DELETE',
    requireAuth: true,
  });
}
