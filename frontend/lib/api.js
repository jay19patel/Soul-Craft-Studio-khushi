/**
 * lib/api.js
 * ──────────
 * Central API client for Soul Craft Studio. All pages import from here.
 *
 * Server actions return `{ ok, data | error }` (so real error messages survive
 * production builds); `unwrap` turns that back into a normal value or a thrown
 * Error, so pages can keep using try/catch.
 */

import * as server from './serverActions';

function unwrap(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || 'Something went wrong. Please try again.');
  }
  return result.data;
}

const call = async (fn, ...args) => unwrap(await fn(...args));

// ── Client-side memory cache ──
// Serves repeat catalog reads (shop → product → back) instantly. Mutation
// wrappers below invalidate the matching namespace.
const clientCache = new Map();
const CLIENT_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;

function stableKey(prefix, params) {
  if (!params || typeof params !== 'object') return prefix;
  const sortedEntries = Object.keys(params).sort().map((k) => [k, params[k]]);
  return `${prefix}:${JSON.stringify(sortedEntries)}`;
}

function withClientCache(key, fetcher) {
  const cached = clientCache.get(key);
  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.time < CLIENT_CACHE_TTL_MS) return Promise.resolve(cached.value);

  const promise = fetcher()
    .then((value) => {
      clientCache.set(key, { value, time: Date.now() });
      while (clientCache.size > MAX_CACHE_ENTRIES) clientCache.delete(clientCache.keys().next().value);
      return value;
    })
    .catch((err) => {
      clientCache.delete(key);
      throw err;
    });
  clientCache.set(key, { value: cached?.value, time: cached?.time ?? 0, promise });
  return promise;
}

export function invalidateClientCache(prefix) {
  for (const key of clientCache.keys()) {
    if (key === prefix || key.startsWith(`${prefix}:`)) clientCache.delete(key);
  }
}

const invalidateCatalog = () => {
  invalidateClientCache('products');
  invalidateClientCache('product');
  invalidateClientCache('categories');
};

import { normalizeCategory, normalizeProduct, normalizeOrder } from './normalize';

export { normalizeCategory, normalizeProduct, normalizeOrder };

// ── Storefront ──

export async function getPublicSettings() {
  return withClientCache('settings', () => call(server.getPublicSettings));
}

export async function getCategories() {
  return withClientCache('categories', async () => {
    const data = await call(server.getCategories);
    return (data?.results ?? []).map(normalizeCategory);
  });
}

export async function getProducts(params = {}) {
  return withClientCache(stableKey('products', params), async () => {
    const data = await call(server.getProducts, params);
    return { results: (data?.results ?? []).map(normalizeProduct), total: data?.total ?? 0 };
  });
}

export async function getProduct(id) {
  return withClientCache(`product:${id}`, async () => normalizeProduct(await call(server.getProduct, id)));
}

export async function getTestimonials() {
  const data = await call(server.getTestimonials);
  return data?.results ?? [];
}

export async function submitContactMessage(messageData) {
  return call(server.submitContactMessage, messageData);
}

// ── Auth ──

export const register = (data) => call(server.register, data);
export const login = (email, password) => call(server.login, email, password);
export const logout = () => call(server.logout);
export const getMe = () => call(server.getMe);
export const updateProfile = (data) => call(server.updateProfile, data);

// ── Cart ──

export const fetchActiveCart = () => call(server.fetchActiveCart);
export const fetchCart = fetchActiveCart;
export const updateCart = (cartId, payload) => call(server.updateCart, cartId, payload);
export const createCart = () => fetchActiveCart();

// ── Addresses / contacts / reviews ──

export const getAddresses = () => call(server.getAddresses);
export const addAddress = (payload) => call(server.addAddress, payload);
export const setDefaultAddress = (id) => call(server.setDefaultAddress, id);
export const deleteAddress = (id) => call(server.deleteAddress, id);
export const getContacts = () => call(server.getContacts);
export const addContact = (payload) => call(server.addContact, payload);
export const setDefaultContact = (id) => call(server.setDefaultContact, id);
export const getMyTestimonial = () => call(server.getMyTestimonial);
export const submitTestimonial = (payload) => call(server.submitTestimonial, payload);

// ── Orders & payments ──

export async function createOrder(payload) {
  const data = await call(server.createOrder, payload);
  invalidateClientCache('products');
  invalidateClientCache('product');
  return { order: normalizeOrder(data.order) };
}

export const getOrder = async (id) => normalizeOrder(await call(server.getOrder, id));

export async function getMyOrders(params = {}) {
  const data = await call(server.getMyOrders, params);
  return { results: (data?.results ?? []).map(normalizeOrder), total: data?.total ?? 0 };
}

export const getOrders = (_email = null, params = {}) => getMyOrders(params);
export const cancelMyOrder = async (id, reason) => normalizeOrder(await call(server.cancelMyOrder, id, reason));

export async function uploadScreenshot(file) {
  const formData = new FormData();
  formData.append('file', file);
  return call(server.uploadScreenshot, formData);
}

// ── Admin ──

export const getAdminStats = (range = '7d') => call(server.getAdminStats, range);
export const getAdminAlerts = () => call(server.getAdminAlerts);

export async function getAdminOrders(params = {}) {
  const data = await call(server.getAdminOrders, params);
  return { results: (data?.results ?? []).map(normalizeOrder), total: data?.total ?? 0 };
}

export async function getAdminOrder(id) {
  const data = await call(server.getAdminOrder, id);
  return { ...data, order: normalizeOrder(data.order) };
}

export const updateAdminOrderStatus = async (id, payload) => normalizeOrder(await call(server.updateAdminOrderStatus, id, payload));
export const updateAdminPaymentStatus = async (id, payload) => normalizeOrder(await call(server.updateAdminPaymentStatus, id, payload));
export const updateAdminOrderNote = async (id, note) => normalizeOrder(await call(server.updateAdminOrderNote, id, note));
export const resolveAdminOrderAttention = async (id) => normalizeOrder(await call(server.resolveAdminOrderAttention, id));
export const deleteAdminOrder = (id) => call(server.deleteAdminOrder, id);

export async function getAdminProducts() {
  return (await call(server.getAdminProducts)).map(normalizeProduct);
}
export const getAdminProduct = async (id) => normalizeProduct(await call(server.getAdminProduct, id));

export async function saveAdminProduct(id, data) {
  const result = normalizeProduct(await call(server.saveAdminProduct, id, data));
  invalidateCatalog();
  return result;
}

export async function setAdminProductFlags(id, flags) {
  const result = normalizeProduct(await call(server.setAdminProductFlags, id, flags));
  invalidateCatalog();
  return result;
}

export async function deleteAdminProduct(id) {
  const result = await call(server.deleteAdminProduct, id);
  invalidateCatalog();
  return result;
}

export async function uploadAdminImage(file, folder = 'products') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  return (await call(server.uploadAdminImage, formData)).url;
}

export async function saveAdminCategory(id, data) {
  const result = normalizeCategory(await call(server.saveAdminCategory, id, data));
  invalidateCatalog();
  return result;
}

export async function deleteAdminCategory(id) {
  const result = await call(server.deleteAdminCategory, id);
  invalidateCatalog();
  return result;
}

export const getAdminTestimonials = () => call(server.getAdminTestimonials);
export const saveAdminTestimonial = (id, data) => call(server.saveAdminTestimonial, id, data);
export const setAdminTestimonialFlags = (id, flags) => call(server.setAdminTestimonialFlags, id, flags);
export const deleteAdminTestimonial = (id) => call(server.deleteAdminTestimonial, id);

export const getAdminMessages = () => call(server.getAdminMessages);
export const updateAdminMessage = (id, data) => call(server.updateAdminMessage, id, data);
export const deleteAdminMessage = (id) => call(server.deleteAdminMessage, id);

export const getAdminUsers = () => call(server.getAdminUsers);
export const setAdminUserActive = (id, active) => call(server.setAdminUserActive, id, active);
export const getAdminCarts = () => call(server.getAdminCarts);

export const getAdminEmailLogs = (params) => call(server.getAdminEmailLogs, params);
export const resendAdminEmail = (id) => call(server.resendAdminEmail, id);
export const sendAdminTestEmail = (to) => call(server.sendAdminTestEmail, to);
export const getAdminActivity = (params) => call(server.getAdminActivity, params);

export const getAdminSettings = () => call(server.getAdminSettings);
export async function saveAdminSettings(section, values) {
  const result = await call(server.saveAdminSettings, section, values);
  invalidateClientCache('settings');
  return result;
}
