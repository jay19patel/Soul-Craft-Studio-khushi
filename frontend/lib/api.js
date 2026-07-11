/**
 * lib/api.js
 * ──────────
 * Central API client for Soul Craft Studio.
 * All pages import from here — never fetch() directly.
 *
 * Modified to call Server Actions directly instead of Django endpoints.
 * Keeps the identical signatures and data normalization to prevent client breakages.
 */

import * as server from './serverActions';

export const API_BASE = "";
export const MEDIA_BASE = "";

// ── Client-side memory cache ──
// Speeds up back/forward navigation (e.g. shop → product → back to shop):
// serves the previous result instantly instead of re-calling the server
// action, then silently revalidates in the background if the entry is stale.
// Lives only for the current browser session (cleared on hard reload).
// Invalidated explicitly by admin mutations via invalidateClientCache() below —
// it has no automatic link to the server's revalidateTag(), so every mutation
// wrapper in this file must call invalidateClientCache() itself.
const clientCache = new Map();
const CLIENT_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;

// Builds a cache key that's stable regardless of property insertion order.
function stableKey(prefix, params) {
  if (!params || typeof params !== 'object') return prefix;
  const sortedEntries = Object.keys(params).sort().map((k) => [k, params[k]]);
  return `${prefix}:${JSON.stringify(sortedEntries)}`;
}

function pruneCache() {
  while (clientCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = clientCache.keys().next().value;
    clientCache.delete(oldestKey);
  }
}

function withClientCache(key, fetcher) {
  const cached = clientCache.get(key);

  // An identical request is already in flight — share it instead of firing a duplicate.
  if (cached?.promise) {
    return cached.promise;
  }

  if (cached && Date.now() - cached.time < CLIENT_CACHE_TTL_MS) {
    return Promise.resolve(cached.value);
  }

  const promise = fetcher()
    .then((value) => {
      clientCache.set(key, { value, time: Date.now() });
      pruneCache();
      return value;
    })
    .catch((err) => {
      if (cached) {
        // Keep serving the last known-good value, but record this attempt so
        // we back off instead of retrying the server on every single call.
        clientCache.set(key, { value: cached.value, time: Date.now() });
        return cached.value;
      }
      clientCache.delete(key);
      throw err;
    });

  clientCache.set(key, { value: cached?.value, time: cached?.time ?? 0, promise });
  return promise;
}

// Clears every cache entry under a given namespace (e.g. 'products', 'product',
// 'categories') — call this from any mutation so admins/shoppers see fresh
// data immediately instead of waiting out CLIENT_CACHE_TTL_MS.
function invalidateClientCache(prefix) {
  for (const key of clientCache.keys()) {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      clientCache.delete(key);
    }
  }
}

// ── Normalization Helpers ──

function resolveImageUrl(val) {
  if (!val) return null;
  if (typeof val === "string") {
    return val; // In Next.js, images are served locally from /media/...
  }
  const path = val.file_path || val.url || null;
  return path;
}

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

export function normalizeProduct(p) {
  if (!p) return null;
  const galleryFromAttachments = Array.isArray(p.gallery_images)
    ? p.gallery_images.map(resolveImageUrl).filter(Boolean)
    : [];
  const mainImage = resolveImageUrl(p.primary_image) || resolveImageUrl(p.image_url);
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

export function normalizeCart(c) {
  if (!c) return null;
  return {
    ...c,
    id: String(c.id || c._id || ""),
    items: (c.items || []).map((item) => {
      const productImage = item.product?.primary_image || item.product?.image_url || null;
      return {
        ...item,
        id: String(item.id || item._id || ""),
        image: resolveImageUrl(item.image) || resolveImageUrl(productImage),
      };
    }),
  };
}

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

// ── Wrapper API Calls calling Server Actions ──

export async function getCategories() {
  return withClientCache('categories', async () => {
    const data = await server.getCategories();
    const results = data?.results ?? [];
    return results.map(normalizeCategory);
  });
}

export async function createAdminCategory(categoryData) {
  const data = await server.createAdminCategory(categoryData);
  invalidateClientCache('categories');
  invalidateClientCache('products'); // product listings embed category name/image
  return normalizeCategory(data);
}

export async function updateAdminCategory(id, categoryData) {
  const data = await server.updateAdminCategory(id, categoryData);
  invalidateClientCache('categories');
  invalidateClientCache('products');
  return normalizeCategory(data);
}

export async function deleteAdminCategory(id) {
  const result = await server.deleteAdminCategory(id);
  invalidateClientCache('categories');
  invalidateClientCache('products');
  return result;
}

export async function getTestimonials() {
  const data = await server.getTestimonials();
  return data?.results ?? [];
}

export async function getMyTestimonial() {
  return await server.getMyTestimonial();
}

export async function submitTestimonial(payload) {
  return await server.submitTestimonial(payload);
}

export async function getProducts(params = {}) {
  return withClientCache(stableKey('products', params), async () => {
    const data = await server.getProducts(params);
    const results = data?.results ?? [];
    return {
      results: results.map(normalizeProduct),
      total: data?.total ?? results.length
    };
  });
}

export async function getProduct(id) {
  return withClientCache(`product:${id}`, async () => {
    const data = await server.getProduct(id);
    return normalizeProduct(data);
  });
}

export async function createOrder(payload) {
  const data = await server.createOrder(payload);
  invalidateClientCache('products'); // order placement reduces variant stock
  invalidateClientCache('product');
  return normalizeOrder(data);
}

export async function getOrder(id) {
  const data = await server.getOrder(id);
  return normalizeOrder(data);
}

export async function getMyOrders(params = {}) {
  const results = await server.getMyOrders(params);
  return results.map(normalizeOrder);
}

export async function getOrders(email = null, params = {}) {
  const data = await server.getOrders(email, params);
  const results = data?.results ?? [];
  return {
    results: results.map(normalizeOrder),
    total: data?.total ?? results.length
  };
}

export async function register(data) {
  return await server.register(data);
}

export async function login(email, password) {
  return await server.login(email, password);
}

export async function getMe() {
  return await server.getMe();
}

export async function updateProfile(data) {
  return await server.updateProfile(data);
}

export async function logout() {
  return await server.logout();
}

export async function getPayments(params = {}) {
  const data = await server.getPayments(params);
  const results = data?.results ?? [];
  return results.map(normalizePayment);
}

export async function fetchCart(params = {}) {
  const cart = await server.fetchActiveCart();
  return normalizeCart(cart);
}

export async function fetchActiveCart() {
  return await fetchCart();
}

export async function uploadScreenshot(file) {
  const formData = new FormData();
  formData.append("file", file);
  return await server.uploadScreenshot(formData);
}

export async function createCart(payload) {
  const cart = await server.createCart(payload);
  return normalizeCart(cart);
}

export async function updateCart(cartId, payload) {
  const cart = await server.updateCart(cartId, payload);
  return normalizeCart(cart);
}

export async function getAddresses() {
  return await server.getAddresses();
}

export async function addAddress(payload) {
  return await server.addAddress(payload);
}

export async function setDefaultAddress(id) {
  return await server.setDefaultAddress(id);
}

export async function getContacts() {
  return await server.getContacts();
}

export async function addContact(payload) {
  return await server.addContact(payload);
}

export async function setDefaultContact(id) {
  return await server.setDefaultContact(id);
}

export async function getAdminStats(range = '7d') {
  return await server.getAdminStats(range);
}

export async function getAdminOrders(params = {}) {
  const data = await server.getAdminOrders(params);
  const results = data?.results ?? [];
  return {
    results: results.map(normalizeOrder),
    total: data?.total ?? results.length
  };
}

export async function getAdminOrder(id) {
  const order = await server.getAdminOrder(id);
  return normalizeOrder(order);
}

export async function deleteAdminOrder(id) {
  return await server.deleteAdminOrder(id);
}

export async function updateAdminOrder(id, payload) {
  const order = await server.updateAdminOrder(id, payload);
  return normalizeOrder(order);
}

export async function getAdminProducts() {
  const products = await server.getAdminProducts();
  return products.map(normalizeProduct);
}

export async function createAdminProduct(productData) {
  // If productData is FormData, pass it directly, else handle object
  const data = await server.createAdminProduct(productData);
  invalidateClientCache('products');
  invalidateClientCache('product');
  return normalizeProduct(data);
}

export async function updateAdminProduct(id, productData) {
  const data = await server.updateAdminProduct(id, productData);
  invalidateClientCache('products');
  invalidateClientCache('product');
  return normalizeProduct(data);
}

export async function deleteAdminProduct(id) {
  const result = await server.deleteAdminProduct(id);
  invalidateClientCache('products');
  invalidateClientCache('product');
  return result;
}

export async function submitContactMessage(messageData) {
  return await server.submitContactMessage(messageData);
}

export async function getAdminMessages() {
  return await server.getAdminMessages();
}

export async function updateAdminMessage(id, messageData) {
  return await server.updateAdminMessage(id, messageData);
}

export async function deleteAdminMessage(id) {
  return await server.deleteAdminMessage(id);
}

export async function getAdminUsers() {
  return await server.getAdminUsers();
}

export async function getAdminCarts() {
  return await server.getAdminCarts();
}

export async function getAdminEmailLogs() {
  return await server.getAdminEmailLogs();
}
