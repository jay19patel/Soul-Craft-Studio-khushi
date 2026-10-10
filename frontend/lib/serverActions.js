"use server";

/**
 * Every function exported from this file is a Server Action — i.e. callable
 * from the browser. So every one of them must check who is calling and
 * validate its input. Each returns `{ ok: true, data }` or `{ ok: false, error }`
 * (see run() in lib/server/core.js); lib/api.js unwraps that for the UI.
 */

import { cookies } from 'next/headers';
import { after } from 'next/server';
import crypto from 'crypto';
import { getDb } from './db';
import { verifyPassword, hashPassword, signToken } from './auth';
import { uploadImageFile, UploadError } from './upload';
import {
  run, fail, nowIso, getQueryById, escapeRegExp, slugify, invalidate, logActivity,
  cleanText, cleanMultiline, cleanEmail, cleanPhone, cleanPincode, cleanNumber,
  getAuthenticatedUser, requireUser, requireAdmin,
} from './server/core';
import {
  getSettings, getPublicSettings as loadPublicSettings, saveSettingsSection, DEFAULT_SETTINGS,
} from './server/settings';
import {
  listCategoriesCached, queryProducts, getActiveProduct, getAnyProduct, serializeProduct,
  serializeTestimonial, listPublicTestimonialsCached, getCategoryMap, effectivePrice, primaryImageOf, totalStockOf,
} from './server/catalog';
import {
  placeOrder, loadOrder, findOrderDoc, serializeOrders,
  changeOrderStatus, changePaymentStatus, ORDER_STATUSES, PAYMENT_STATUSES,
} from './server/orders';
import {
  sendWelcomeEmail, sendAdminContactMessageEmail, resendLoggedEmail, buildInvoiceAttachment,
  deliverEmail, isSmtpConfigured, EMAIL_TYPES, SITE_URL,
} from './email';
import { normalizeVideoList, getYouTubeId, isYouTubeShortUrl } from './youtube';

// ── Session cookie ──

async function setAuthCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

function backgroundTask(fn) {
  const task = () => fn().catch((err) => console.error('[background]', err));
  try {
    after(task);
  } catch {
    task();
  }
}

const publicUser = (u) => ({
  id: u._id.toString(),
  email: u.email,
  full_name: u.first_name || '',
  is_superuser: !!u.is_superuser,
});

// ══════════════════════════════════════════════════════════════════════
// STOREFRONT (public)
// ══════════════════════════════════════════════════════════════════════

export async function getPublicSettings() {
  return run(() => loadPublicSettings());
}

export async function getCategories() {
  return run(async () => ({ results: await listCategoriesCached() }));
}

export async function getProducts(params = {}) {
  return run(() =>
    queryProducts({
      category_id: params.category_id || params.category,
      search: params.search,
      discount_only: !!params.discount_only,
      in_stock_only: !!params.in_stock_only,
      sort_by: params.sort_by,
      page: params.page,
      page_size: params.page_size,
      exclude_id: params.exclude_id,
    })
  );
}

export async function getProduct(id) {
  return run(async () => {
    const product = await getActiveProduct(id);
    if (!product) fail('This product is not available.');
    return product;
  });
}

export async function getTestimonials() {
  return run(async () => ({ results: await listPublicTestimonialsCached() }));
}

export async function submitContactMessage(messageData = {}) {
  return run(async () => {
    const doc = {
      name: cleanText(messageData.name, { max: 80, required: true, label: 'Name' }),
      email: cleanEmail(messageData.email),
      subject: cleanText(messageData.subject, { max: 150, label: 'Subject' }) || 'General inquiry',
      message: cleanMultiline(messageData.message, { max: 3000, required: true, label: 'Message' }),
      is_read: false,
      created_at: nowIso(),
    };
    const db = await getDb();

    // Basic flood protection: max 5 messages per email per hour.
    const recent = await db.collection('contactmessages').countDocuments({
      email: doc.email,
      created_at: { $gt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    });
    if (recent >= 5) fail('You have sent several messages recently. We will get back to you soon!');

    const result = await db.collection('contactmessages').insertOne(doc);
    backgroundTask(() => sendAdminContactMessageEmail(doc));
    return { id: result.insertedId.toString(), created_at: doc.created_at };
  });
}

// ══════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;

export async function register(data = {}) {
  return run(async () => {
    const db = await getDb();
    const email = cleanEmail(data.email);
    const name = cleanText(data.full_name, { max: 80, required: true, label: 'Full name' });
    const password = String(data.password || '');
    if (password.length < 8) fail('Password must be at least 8 characters.');
    if (password.length > 128) fail('Password is too long.');

    const existing = await db.collection('users').findOne({ $or: [{ username: email }, { email }] });
    if (existing) fail('An account with this email already exists. Please log in.');

    const now = nowIso();
    const result = await db.collection('users').insertOne({
      password: hashPassword(password),
      last_login: now,
      is_superuser: false,
      username: email,
      last_name: '',
      email,
      is_active: true,
      date_joined: now,
      first_name: name,
    });

    const userId = result.insertedId.toString();
    await setAuthCookie(signToken({ id: userId }));
    backgroundTask(() => sendWelcomeEmail({ id: userId, email, full_name: name }));
    return { user: { id: userId, email, full_name: name, is_superuser: false } };
  });
}

export async function login(email, password) {
  return run(async () => {
    const db = await getDb();
    const cleanEmailValue = String(email || '').trim().toLowerCase();
    if (!cleanEmailValue || !password) fail('Please enter your email and password.');

    const since = new Date(Date.now() - LOGIN_WINDOW_MS);
    const failures = await db.collection('login_attempts').countDocuments({ key: cleanEmailValue, at: { $gt: since } });
    if (failures >= LOGIN_MAX_FAILURES) fail('Too many failed attempts. Please wait 15 minutes and try again.');

    const user = await db.collection('users').findOne({ $or: [{ username: cleanEmailValue }, { email: cleanEmailValue }] });
    if (!user || !verifyPassword(password, user.password)) {
      await db.collection('login_attempts').insertOne({ key: cleanEmailValue, at: new Date() });
      fail('Invalid email or password.');
    }
    if (!user.is_active) fail('This account has been disabled. Please contact us.');

    await db.collection('login_attempts').deleteMany({ key: cleanEmailValue });
    await db.collection('users').updateOne({ _id: user._id }, { $set: { last_login: nowIso() } });
    await setAuthCookie(signToken({ id: user._id.toString() }));
    return { user: publicUser(user) };
  });
}

export async function logout() {
  return run(async () => {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    return { detail: 'Logged out.' };
  });
}

export async function getMe() {
  return run(() => getAuthenticatedUser());
}

export async function updateProfile(data = {}) {
  return run(async () => {
    const currentUser = await requireUser();
    const db = await getDb();
    const updates = {};

    if (data.full_name !== undefined) {
      updates.first_name = cleanText(data.full_name, { max: 80, required: true, label: 'Full name' });
    }
    if (data.password) {
      const password = String(data.password);
      if (password.length < 8) fail('New password must be at least 8 characters.');
      const userDoc = await db.collection('users').findOne(getQueryById(currentUser.id));
      if (!verifyPassword(String(data.current_password || ''), userDoc.password)) fail('Your current password is incorrect.');
      updates.password = hashPassword(password);
      updates.password_changed_at = nowIso();
    }

    if (Object.keys(updates).length) {
      await db.collection('users').updateOne(getQueryById(currentUser.id), { $set: updates });
    }
    if (updates.password) {
      // Old sessions are now invalid — issue a fresh one for this device.
      await setAuthCookie(signToken({ id: currentUser.id }));
    }
    const updated = await db.collection('users').findOne(getQueryById(currentUser.id));
    return publicUser(updated);
  });
}

// ══════════════════════════════════════════════════════════════════════
// CART
// ══════════════════════════════════════════════════════════════════════

async function buildCart(db, cart) {
  const ids = (cart.items || []).map((i) => i.product_id);
  const products = ids.length
    ? await db.collection('products').find({ $or: ids.flatMap((id) => getQueryById(id).$or || [getQueryById(id)]) }).toArray()
    : [];
  const byId = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  const items = [];
  for (const item of cart.items || []) {
    const p = byId[String(item.product_id)];
    if (!p || !p.is_active) continue; // disabled/deleted products silently drop out of the cart
    const variant = (p.variants || [])[0];
    if (!variant) continue;
    const stock = Math.max(0, Number(variant.stock || 0));
    const price = effectivePrice(variant.price_override || p.base_price, p.discount);
    items.push({
      id: p._id.toString(),
      product_id: p._id.toString(),
      name: p.name,
      image: primaryImageOf(p),
      quantity: Number(item.quantity || 1),
      price,
      mrp: Number(variant.price_override || p.base_price || 0),
      stock,
    });
  }
  return { id: cart._id.toString(), items };
}

export async function fetchActiveCart() {
  return run(async () => {
    const user = await getAuthenticatedUser();
    if (!user) return null;
    const db = await getDb();
    let cart = await db.collection('carts').findOne({ user_id: user.id });
    if (!cart) {
      const now = nowIso();
      const res = await db.collection('carts').insertOne({ user_id: user.id, items: [], created_at: now, updated_at: now });
      cart = { _id: res.insertedId, items: [] };
    }
    return buildCart(db, cart);
  });
}

/** Replaces the user's cart lines. Quantities are clamped to available stock. */
export async function updateCart(_cartId, payload = {}) {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();

    const merged = new Map();
    for (const raw of (payload.items || []).slice(0, 30)) {
      const pid = String(raw?.product || raw?.product_id || '').trim();
      const qty = Math.floor(Number(raw?.quantity));
      if (!pid || !Number.isFinite(qty) || qty < 1) continue;
      merged.set(pid, Math.min(20, (merged.get(pid) || 0) + qty));
    }

    const items = [];
    for (const [pid, qty] of merged) {
      const p = await db.collection('products').findOne(getQueryById(pid), { projection: { variants: 1, is_active: 1 } });
      const variant = p?.variants?.[0];
      if (!p || !p.is_active || !variant) continue;
      const stock = Math.max(0, Number(variant.stock || 0));
      if (stock < 1) continue;
      items.push({ id: crypto.randomUUID(), product_id: p._id.toString(), variant_id: String(variant.id), quantity: Math.min(qty, stock) });
    }

    const now = nowIso();
    await db.collection('carts').updateOne(
      { user_id: user.id },
      { $set: { items, updated_at: now }, $setOnInsert: { created_at: now } },
      { upsert: true }
    );
    const cart = await db.collection('carts').findOne({ user_id: user.id });
    return buildCart(db, cart);
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADDRESSES & CONTACTS
// ══════════════════════════════════════════════════════════════════════

export async function getAddresses() {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const rows = await db.collection('addresses').find({ user_id: user.id }).sort({ is_default: -1, created_at: -1 }).toArray();
    return rows.map(({ _id, user_id, ...a }) => ({ ...a, id: _id.toString() }));
  });
}

export async function addAddress(payload = {}) {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const count = await db.collection('addresses').countDocuments({ user_id: user.id });
    if (count >= 10) fail('You can save up to 10 addresses.');

    const doc = {
      full_name: cleanText(payload.full_name, { max: 80, required: true, label: 'Full name' }),
      address_line: cleanText(payload.address_line, { max: 300, required: true, label: 'Address' }),
      city: cleanText(payload.city, { max: 60, required: true, label: 'City' }),
      state: cleanText(payload.state, { max: 60, required: true, label: 'State' }),
      pincode: cleanPincode(payload.pincode),
      is_default: !!payload.is_default || count === 0,
      created_at: nowIso(),
      user_id: user.id,
    };
    if (doc.is_default) await db.collection('addresses').updateMany({ user_id: user.id }, { $set: { is_default: false } });
    const res = await db.collection('addresses').insertOne(doc);
    const { _id, user_id, ...rest } = doc;
    return { ...rest, id: res.insertedId.toString() };
  });
}

export async function setDefaultAddress(id) {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const addr = await db.collection('addresses').findOne({ ...getQueryById(id), user_id: user.id });
    if (!addr) fail('Address not found.');
    await db.collection('addresses').updateMany({ user_id: user.id }, { $set: { is_default: false } });
    await db.collection('addresses').updateOne({ _id: addr._id }, { $set: { is_default: true } });
    return { success: true };
  });
}

export async function deleteAddress(id) {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    await db.collection('addresses').deleteOne({ ...getQueryById(id), user_id: user.id });
    return { success: true };
  });
}

export async function getContacts() {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const rows = await db.collection('contacts').find({ user_id: user.id }).sort({ is_default: -1, created_at: -1 }).toArray();
    return rows.map(({ _id, user_id, ...c }) => ({ ...c, id: _id.toString() }));
  });
}

export async function addContact(payload = {}) {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const count = await db.collection('contacts').countDocuments({ user_id: user.id });
    if (count >= 10) fail('You can save up to 10 phone numbers.');
    const doc = {
      phone_number: cleanPhone(payload.phone_number),
      is_default: !!payload.is_default || count === 0,
      created_at: nowIso(),
      user_id: user.id,
    };
    if (doc.is_default) await db.collection('contacts').updateMany({ user_id: user.id }, { $set: { is_default: false } });
    const res = await db.collection('contacts').insertOne(doc);
    const { _id, user_id, ...rest } = doc;
    return { ...rest, id: res.insertedId.toString() };
  });
}

export async function setDefaultContact(id) {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const contact = await db.collection('contacts').findOne({ ...getQueryById(id), user_id: user.id });
    if (!contact) fail('Phone number not found.');
    await db.collection('contacts').updateMany({ user_id: user.id }, { $set: { is_default: false } });
    await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { is_default: true } });
    return { success: true };
  });
}

// ══════════════════════════════════════════════════════════════════════
// CUSTOMER REVIEWS
// ══════════════════════════════════════════════════════════════════════

export async function getMyTestimonial() {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const t = await db.collection('testimonials').findOne({ user_id: user.id });
    return t ? serializeTestimonial(t) : null;
  });
}

export async function submitTestimonial(payload = {}) {
  return run(async () => {
    const user = await requireUser();
    const settings = await getSettings();
    const content = cleanMultiline(payload.content, { max: 1000, required: true, label: 'Your review' });
    const rating = Math.min(5, Math.max(1, Math.round(Number(payload.rating) || 5)));
    const autoApprove = !!settings.reviews.auto_approve;

    const db = await getDb();
    const now = nowIso();
    const existing = await db.collection('testimonials').findOne({ user_id: user.id });
    const fields = { content, rating, updated_at: now, is_active: autoApprove, reviewed: autoApprove };

    if (existing) {
      await db.collection('testimonials').updateOne({ _id: existing._id }, { $set: fields });
    } else {
      await db.collection('testimonials').insertOne({
        ...fields,
        user_id: user.id,
        author_name: user.full_name || user.email.split('@')[0],
        source: 'customer',
        created_at: now,
      });
    }
    invalidate('testimonials');
    return { content, rating, pending: !autoApprove };
  });
}

// ══════════════════════════════════════════════════════════════════════
// ORDERS & PAYMENTS (customer)
// ══════════════════════════════════════════════════════════════════════

async function ownedOrderDoc(id) {
  const user = await requireUser();
  const doc = await findOrderDoc(id);
  if (!doc || (!user.is_superuser && String(doc.user_id) !== user.id)) fail('Order not found.');
  return { user, doc };
}

export async function createOrder(payload = {}) {
  return run(async () => {
    const user = await requireUser();
    return placeOrder(user, payload);
  });
}

export async function getOrder(id) {
  return run(async () => {
    const { user, doc } = await ownedOrderDoc(id);
    return loadOrder(doc._id, { admin: user.is_superuser });
  });
}

export async function getMyOrders(params = {}) {
  return run(async () => {
    const user = await requireUser();
    const db = await getDb();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.page_size) || 10));
    const query = { user_id: user.id };
    const [total, docs] = await Promise.all([
      db.collection('orders').countDocuments(query),
      db.collection('orders').find(query).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    return { results: await serializeOrders(db, docs), total };
  });
}

/** Kept for the existing /orders page (always the caller's own orders). */
export async function getOrders(_email = null, params = {}) {
  return getMyOrders(params);
}

export async function cancelMyOrder(id, reason = '') {
  return run(async () => {
    const { user, doc } = await ownedOrderDoc(id);
    const status = String(doc.status || '').toUpperCase();
    if (!['PENDING', 'CONFIRMED'].includes(status)) fail('This order is already being prepared. Please contact us to make changes.');
    if (String(doc.payment_status).toUpperCase() === 'VERIFIED') {
      fail('This order is already paid. Please contact us and we will cancel it and refund you.');
    }
    return changeOrderStatus(doc._id, 'CANCELLED', user.is_superuser ? user : 'customer', {
      cancel_reason: cleanText(reason, { max: 200 }) || 'Cancelled by customer',
    });
  });
}

export async function uploadScreenshot(formData) {
  return run(async () => {
    await requireUser();
    try {
      const url = await uploadImageFile(formData?.get('file'), 'screenshots');
      return { id: url, url };
    } catch (err) {
      if (err instanceof UploadError) fail(err.message);
      throw err;
    }
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — dashboard
// ══════════════════════════════════════════════════════════════════════

const IST = 'Asia/Kolkata';

export async function getAdminStats(range = '7d') {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const now = new Date();

    let start = null;
    let format = '%Y-%m-%d';
    let buckets = [];
    if (range === '7d' || range === '1m') {
      const days = range === '7d' ? 7 : 30;
      start = new Date(now.getTime() - (days - 1) * 86400000);
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        buckets.push({
          key: d.toLocaleDateString('en-CA', { timeZone: IST }),
          label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST }),
        });
      }
    } else if (range === '1y') {
      format = '%Y-%m';
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
        buckets.push({
          key: d.toLocaleDateString('en-CA', { timeZone: IST }).slice(0, 7),
          label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: IST }),
        });
      }
    } else {
      format = '%Y-%m';
    }
    if (start) start.setHours(0, 0, 0, 0);

    const match = { status: { $ne: 'CANCELLED' } };
    if (start) match.created_at = { $gte: start.toISOString() };

    const grouped = await db
      .collection('orders')
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format, date: { $dateFromString: { dateString: '$created_at' } }, timezone: IST } },
            orders: { $sum: 1 },
            sales: { $sum: { $cond: [{ $eq: [{ $toUpper: '$payment_status' }, 'VERIFIED'] }, { $toDouble: '$total_amount' }, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    const byKey = Object.fromEntries(grouped.map((g) => [g._id, g]));

    if (!buckets.length) {
      buckets = grouped.map((g) => {
        const [y, m] = g._id.split('-');
        return { key: g._id, label: new Date(Number(y), Number(m) - 1, 15).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) };
      });
    }
    const daily_stats = buckets.map((b) => ({ label: b.label, sales: byKey[b.key]?.sales || 0, orders: byKey[b.key]?.orders || 0 }));
    if (!daily_stats.length) daily_stats.push({ label: 'No data', sales: 0, orders: 0 });

    const [revenueAgg, totalOrders, pendingOrders, totalProducts, unreadMessages, activeCarts] = await Promise.all([
      db.collection('orders').aggregate([
        { $match: { status: { $ne: 'CANCELLED' }, payment_status: { $in: ['VERIFIED', 'verified'] } } },
        { $group: { _id: null, total: { $sum: { $toDouble: '$total_amount' } } } },
      ]).toArray(),
      db.collection('orders').countDocuments(),
      db.collection('orders').countDocuments({ status: { $in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'pending', 'processing'] } }),
      db.collection('products').countDocuments(),
      db.collection('contactmessages').countDocuments({ is_read: false }),
      db.collection('carts').countDocuments({ 'items.0': { $exists: true } }),
    ]);

    return {
      total_revenue: revenueAgg[0]?.total || 0,
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      total_products: totalProducts,
      unread_messages: unreadMessages,
      active_carts: activeCarts,
      daily_stats,
    };
  });
}

/** Things the owner should act on right now. */
export async function getAdminAlerts() {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const settings = await getSettings();
    const threshold = Number(settings.inventory.low_stock_threshold || 3);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [toVerify, toShip, attention, failedEmails, unread, pendingReviews, products, recentDocs] = await Promise.all([
      db.collection('orders').countDocuments({ payment_status: { $in: ['RECEIVED', 'received'] }, status: { $ne: 'CANCELLED' } }),
      db.collection('orders').countDocuments({ status: { $in: ['CONFIRMED', 'PROCESSING'] } }),
      db.collection('orders').countDocuments({ needs_attention: { $nin: [null, ''] , $exists: true } }),
      db.collection('emaillogs').countDocuments({ status: 'FAILED', queued_at: { $gt: weekAgo } }),
      db.collection('contactmessages').countDocuments({ is_read: false }),
      db.collection('testimonials').countDocuments({ is_active: false, reviewed: { $ne: true } }),
      db.collection('products').find({ is_active: true }, { projection: { name: 1, variants: 1, images: 1 } }).toArray(),
      db.collection('orders').find().sort({ created_at: -1 }).limit(6).toArray(),
    ]);

    const lowStock = products
      .map((p) => ({ id: p._id.toString(), name: p.name, stock: totalStockOf(p), image: primaryImageOf(p) }))
      .filter((p) => p.stock <= threshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);

    return {
      payments_to_verify: toVerify,
      orders_to_ship: toShip,
      needs_attention: attention,
      failed_emails: failedEmails,
      unread_messages: unread,
      pending_reviews: pendingReviews,
      low_stock: lowStock,
      low_stock_threshold: threshold,
      recent_orders: await serializeOrders(db, recentDocs, { admin: true }),
      integrations: {
        smtp: isSmtpConfigured(),
        upi_id: !!(settings.payments.upi_enabled && settings.payments.upi_id),
        cod: !!settings.payments.cod_enabled,
      },
    };
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — orders
// ══════════════════════════════════════════════════════════════════════

export async function getAdminOrders(params = {}) {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const query = {};
    const status = String(params.status || '').toUpperCase();
    const paymentStatus = String(params.payment_status || '').toUpperCase();
    const method = String(params.payment_method || '').toUpperCase();
    if (ORDER_STATUSES.includes(status)) query.status = { $in: [status, status.toLowerCase()] };
    if (PAYMENT_STATUSES.includes(paymentStatus)) query.payment_status = { $in: [paymentStatus, paymentStatus.toLowerCase()] };
    if (['UPI', 'COD'].includes(method)) query.payment_method = method;
    if (params.attention) query.needs_attention = { $nin: [null, ''], $exists: true };
    if (params.search) {
      const re = new RegExp(escapeRegExp(String(params.search).trim().slice(0, 80)), 'i');
      query.$or = [
        { order_number: re }, { _id: re }, { customer_name: re }, { customer_email: re },
        { customer_phone: re }, { upi_transaction_id: re },
      ];
    }

    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.page_size) || 20));
    const [total, docs] = await Promise.all([
      db.collection('orders').countDocuments(query),
      db.collection('orders').find(query).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    return { results: await serializeOrders(db, docs, { admin: true }), total };
  });
}

export async function getAdminOrder(id) {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const order = await loadOrder(id, { admin: true });
    if (!order) fail('Order not found.');
    const [emails, activity] = await Promise.all([
      db.collection('emaillogs').find({ order_id: order.id }).sort({ queued_at: -1 }).limit(30).toArray(),
      db.collection('activity_logs').find({ entity_type: 'order', entity_id: order.id }).sort({ created_at: -1 }).limit(30).toArray(),
    ]);
    return {
      order,
      emails: emails.map(serializeEmailLog),
      activity: activity.map(serializeActivity),
    };
  });
}

export async function updateAdminOrderStatus(id, payload = {}) {
  return run(async () => {
    const admin = await requireAdmin();
    return changeOrderStatus(id, payload.status, admin, {
      tracking: payload.tracking || null,
      cancel_reason: payload.cancel_reason,
      note: payload.note,
      notify: payload.notify !== false,
    });
  });
}

export async function updateAdminPaymentStatus(id, payload = {}) {
  return run(async () => {
    const admin = await requireAdmin();
    return changePaymentStatus(id, payload.payment_status, admin, { note: payload.note, notify: payload.notify !== false });
  });
}

export async function updateAdminOrderNote(id, adminNote = '') {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const note = cleanMultiline(adminNote, { max: 2000, label: 'Note' });
    const res = await db.collection('orders').updateOne(getQueryById(id), { $set: { admin_note: note, updated_at: nowIso() } });
    if (!res.matchedCount) fail('Order not found.');
    return loadOrder(id, { admin: true });
  });
}

export async function resolveAdminOrderAttention(id) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.collection('orders').updateOne(getQueryById(id), { $set: { needs_attention: null } });
    await logActivity({ action: 'order.attention_resolved', message: 'Attention flag cleared', entity_type: 'order', entity_id: id, actor: admin });
    return loadOrder(id, { admin: true });
  });
}

/** Orders are financial records — only cancelled ones can be deleted. */
export async function deleteAdminOrder(id) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const order = await db.collection('orders').findOne(getQueryById(id));
    if (!order) fail('Order not found.');
    if (String(order.status).toUpperCase() !== 'CANCELLED') fail('Cancel the order first. Only cancelled orders can be deleted.');
    await db.collection('payments').deleteMany({ order_id: order._id.toString() });
    await db.collection('orders').deleteOne({ _id: order._id });
    await logActivity({ action: 'order.deleted', message: `Deleted cancelled order ${order.order_number || order._id}`, entity_type: 'order', entity_id: order._id, actor: admin });
    return { success: true };
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — products & categories
// ══════════════════════════════════════════════════════════════════════

export async function getAdminProducts() {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const [products, categoryMap] = await Promise.all([
      db.collection('products').find().sort({ created_at: -1 }).toArray(),
      getCategoryMap(db),
    ]);
    return products.map((p) => serializeProduct(p, categoryMap));
  });
}

export async function getAdminProduct(id) {
  return run(async () => {
    await requireAdmin();
    const product = await getAnyProduct(id);
    if (!product) fail('Product not found.');
    return product;
  });
}

export async function uploadAdminImage(formData) {
  return run(async () => {
    await requireAdmin();
    const folder = ['products', 'categories', 'site', 'testimonials'].includes(formData?.get('folder')) ? formData.get('folder') : 'products';
    try {
      const url = await uploadImageFile(formData?.get('file'), folder);
      return { url };
    } catch (err) {
      if (err instanceof UploadError) fail(err.message);
      throw err;
    }
  });
}

function cleanImageList(list) {
  if (!Array.isArray(list)) return [];
  const urls = [];
  for (const item of list) {
    const url = String(item?.image_url || item || '').trim();
    if (!url) continue;
    if (!(url.startsWith('/api/media/') || url.startsWith('/images/') || url.startsWith('/media/') || /^https:\/\//.test(url))) {
      fail('One of the product images has an invalid address. Please re-upload it.');
    }
    if (!urls.includes(url)) urls.push(url);
  }
  if (urls.length > 12) fail('A product can have at most 12 photos.');
  return urls;
}

async function uniqueSlug(db, base, excludeId) {
  const root = slugify(base) || 'product';
  let candidate = root;
  for (let i = 2; i < 50; i++) {
    const clash = await db.collection('products').findOne({ slug: candidate }, { projection: { _id: 1 } });
    if (!clash || (excludeId && clash._id.toString() === String(excludeId))) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Create (id = null) or update a product with everything the editor sends. */
export async function saveAdminProduct(id, data = {}) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const existing = id ? await db.collection('products').findOne(getQueryById(id)) : null;
    if (id && !existing) fail('Product not found.');

    const name = cleanText(data.name, { max: 120, required: true, label: 'Product name' });
    const categoryId = data.category_id ? String(data.category_id) : null;
    if (categoryId) {
      const cat = await db.collection('categories').findOne(getQueryById(categoryId), { projection: { _id: 1 } });
      if (!cat) fail('Selected category does not exist.');
    }

    let videos;
    try {
      videos = normalizeVideoList(data.videos, { max: 6 });
    } catch (err) {
      fail(err.message);
    }

    const highlights = (Array.isArray(data.highlights) ? data.highlights : [])
      .map((h) => cleanText(h, { max: 120, label: 'Highlight' }))
      .filter(Boolean)
      .slice(0, 8);

    const imageUrls = cleanImageList(data.images);
    const existingImages = existing?.images || [];
    const images = imageUrls.map((url, idx) => ({
      id: existingImages.find((img) => img.image_url === url)?.id || crypto.randomUUID(),
      image_url: url,
      is_primary: idx === 0,
    }));

    const stock = cleanNumber(data.stock ?? 0, { min: 0, max: 100000, integer: true, label: 'Stock' });
    const existingVariant = existing?.variants?.[0];
    const variants = [
      {
        id: existingVariant?.id || crypto.randomUUID(),
        sku: cleanText(data.sku, { max: 60 }) || existingVariant?.sku || `SKU-${slugify(name).toUpperCase().slice(0, 20)}-${crypto.randomInt(1000, 9999)}`,
        size: existingVariant?.size || '',
        color: existingVariant?.color || '',
        price_override: null,
        stock,
      },
      ...(existing?.variants || []).slice(1),
    ];

    const now = nowIso();
    const fields = {
      name,
      slug: await uniqueSlug(db, data.slug || name, existing?._id),
      tagline: cleanText(data.tagline, { max: 160, label: 'Tagline' }),
      description: cleanMultiline(data.description, { max: 5000, label: 'Description' }),
      highlights,
      base_price: cleanNumber(data.base_price, { min: 1, max: 1000000, label: 'Price' }),
      discount: cleanNumber(data.discount || 0, { min: 0, max: 90, integer: true, label: 'Discount %' }),
      category_id: categoryId,
      images,
      videos,
      variants,
      is_active: !!data.is_active,
      is_featured: !!data.is_featured,
      featured_order: cleanNumber(data.featured_order || 0, { min: 0, max: 999, integer: true, label: 'Featured order' }),
      updated_at: now,
    };

    let productId;
    if (existing) {
      await db.collection('products').updateOne({ _id: existing._id }, { $set: fields });
      productId = existing._id.toString();
      const changes = [];
      if (existing.is_active !== fields.is_active) changes.push(fields.is_active ? 'enabled' : 'disabled');
      if (Number(existing.base_price) !== fields.base_price) changes.push(`price ₹${existing.base_price} → ₹${fields.base_price}`);
      if (Number(existing.discount || 0) !== fields.discount) changes.push(`discount ${existing.discount || 0}% → ${fields.discount}%`);
      if (totalStockOf(existing) !== stock) changes.push(`stock ${totalStockOf(existing)} → ${stock}`);
      await logActivity({
        action: 'product.updated',
        message: `Updated "${name}"${changes.length ? ` (${changes.join(', ')})` : ''}`,
        entity_type: 'product',
        entity_id: productId,
        actor: admin,
      });
    } else {
      const res = await db.collection('products').insertOne({ ...fields, created_at: now });
      productId = res.insertedId.toString();
      await logActivity({ action: 'product.created', message: `Created "${name}" (₹${fields.base_price}, stock ${stock})`, entity_type: 'product', entity_id: productId, actor: admin });
    }

    invalidate('products');
    return getAnyProduct(productId);
  });
}

export async function setAdminProductFlags(id, flags = {}) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const product = await db.collection('products').findOne(getQueryById(id));
    if (!product) fail('Product not found.');
    const set = { updated_at: nowIso() };
    if (flags.is_active !== undefined) set.is_active = !!flags.is_active;
    if (flags.is_featured !== undefined) set.is_featured = !!flags.is_featured;
    if (flags.stock !== undefined) {
      set['variants.0.stock'] = cleanNumber(flags.stock, { min: 0, max: 100000, integer: true, label: 'Stock' });
    }
    if (flags.featured_order !== undefined) {
      set.featured_order = cleanNumber(flags.featured_order, { min: 0, max: 999, integer: true, label: 'Homepage position' });
    }
    await db.collection('products').updateOne({ _id: product._id }, { $set: set });
    const parts = [];
    if (set.is_active !== undefined) parts.push(set.is_active ? 'enabled' : 'disabled');
    if (set.is_featured !== undefined) parts.push(set.is_featured ? 'featured on homepage' : 'removed from homepage');
    if (set['variants.0.stock'] !== undefined) parts.push(`stock set to ${set['variants.0.stock']}`);
    if (set.featured_order !== undefined) parts.push(`homepage position ${set.featured_order}`);
    await logActivity({ action: 'product.updated', message: `"${product.name}" ${parts.join(', ')}`, entity_type: 'product', entity_id: id, actor: admin });
    invalidate('products');
    return getAnyProduct(id);
  });
}

export async function deleteAdminProduct(id) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const product = await db.collection('products').findOne(getQueryById(id));
    if (!product) fail('Product not found.');
    await db.collection('products').deleteOne({ _id: product._id });
    await logActivity({ action: 'product.deleted', message: `Deleted "${product.name}"`, entity_type: 'product', entity_id: id, actor: admin });
    invalidate('products');
    return { success: true };
  });
}

export async function saveAdminCategory(id, data = {}) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const name = cleanText(data.name, { max: 60, required: true, label: 'Category name' });
    const fields = {
      name,
      slug: slugify(data.slug || name),
      description: cleanText(data.description, { max: 300, label: 'Description' }),
      sort_order: cleanNumber(data.sort_order || 0, { min: 0, max: 999, integer: true, label: 'Order' }),
      updated_at: nowIso(),
    };
    if (data.image_url !== undefined) {
      const [url] = cleanImageList(data.image_url ? [data.image_url] : []);
      fields.image_url = url || null;
    }
    const clash = await db.collection('categories').findOne({ slug: fields.slug });
    if (clash && clash._id.toString() !== String(id || '')) fail('Another category already uses this name/slug.');

    let catId = id;
    if (id) {
      const res = await db.collection('categories').updateOne(getQueryById(id), { $set: fields });
      if (!res.matchedCount) fail('Category not found.');
    } else {
      catId = crypto.randomUUID();
      await db.collection('categories').insertOne({ _id: catId, ...fields, created_at: fields.updated_at });
    }
    await logActivity({ action: id ? 'category.updated' : 'category.created', message: `${id ? 'Updated' : 'Created'} category "${name}"`, entity_type: 'category', entity_id: catId, actor: admin });
    invalidate('categories', 'products');
    return { id: String(catId), ...fields };
  });
}

export async function deleteAdminCategory(id) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const cat = await db.collection('categories').findOne(getQueryById(id));
    if (!cat) fail('Category not found.');
    const res = await db.collection('products').updateMany({ category_id: cat._id.toString() }, { $set: { category_id: null } });
    await db.collection('categories').deleteOne({ _id: cat._id });
    await logActivity({ action: 'category.deleted', message: `Deleted category "${cat.name}" (${res.modifiedCount} products now uncategorised)`, entity_type: 'category', entity_id: id, actor: admin });
    invalidate('categories', 'products');
    return { success: true };
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — testimonials (text + video reviews)
// ══════════════════════════════════════════════════════════════════════

export async function getAdminTestimonials() {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const rows = await db.collection('testimonials').find().sort({ created_at: -1 }).toArray();
    return rows.map((t) => ({ ...serializeTestimonial(t), reviewed: !!t.reviewed }));
  });
}

export async function saveAdminTestimonial(id, data = {}) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const videoUrl = cleanText(data.video_url, { max: 300 });
    const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;
    if (videoUrl && !youtubeId) fail('Video must be a valid YouTube link (youtube.com/watch, youtu.be or youtube.com/shorts).');

    const content = cleanMultiline(data.content, { max: 1000, label: 'Review text' });
    if (!content && !youtubeId) fail('Add either review text or a YouTube video.');

    const fields = {
      author_name: cleanText(data.author_name, { max: 80, required: true, label: 'Customer name' }),
      author_location: cleanText(data.author_location, { max: 80 }),
      content,
      rating: Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5))),
      video_url: videoUrl,
      youtube_id: youtubeId,
      is_short: youtubeId ? (data.is_short !== undefined ? !!data.is_short : isYouTubeShortUrl(videoUrl)) : false,
      product_id: data.product_id ? String(data.product_id) : null,
      is_active: !!data.is_active,
      is_featured: !!data.is_featured,
      reviewed: true,
      updated_at: nowIso(),
    };

    let tid = id;
    if (id) {
      const res = await db.collection('testimonials').updateOne(getQueryById(id), { $set: fields });
      if (!res.matchedCount) fail('Review not found.');
    } else {
      const res = await db.collection('testimonials').insertOne({ ...fields, source: 'admin', created_at: fields.updated_at });
      tid = res.insertedId.toString();
    }
    await logActivity({ action: id ? 'testimonial.updated' : 'testimonial.created', message: `${id ? 'Updated' : 'Added'} review by ${fields.author_name}${fields.is_active ? '' : ' (hidden)'}`, entity_type: 'testimonial', entity_id: tid, actor: admin });
    invalidate('testimonials');
    const doc = await db.collection('testimonials').findOne(getQueryById(tid));
    return serializeTestimonial(doc);
  });
}

export async function setAdminTestimonialFlags(id, flags = {}) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const set = { reviewed: true, updated_at: nowIso() };
    if (flags.is_active !== undefined) set.is_active = !!flags.is_active;
    if (flags.is_featured !== undefined) set.is_featured = !!flags.is_featured;
    const res = await db.collection('testimonials').findOneAndUpdate(getQueryById(id), { $set: set }, { returnDocument: 'after' });
    if (!res) fail('Review not found.');
    await logActivity({ action: 'testimonial.updated', message: `Review by ${res.author_name} ${set.is_active === false ? 'hidden' : set.is_active ? 'approved' : 'updated'}`, entity_type: 'testimonial', entity_id: id, actor: admin });
    invalidate('testimonials');
    return serializeTestimonial(res);
  });
}

export async function deleteAdminTestimonial(id) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const doc = await db.collection('testimonials').findOne(getQueryById(id));
    if (!doc) fail('Review not found.');
    await db.collection('testimonials').deleteOne({ _id: doc._id });
    await logActivity({ action: 'testimonial.deleted', message: `Deleted review by ${doc.author_name}`, entity_type: 'testimonial', entity_id: id, actor: admin });
    invalidate('testimonials');
    return { success: true };
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — messages, customers, carts
// ══════════════════════════════════════════════════════════════════════

export async function getAdminMessages() {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const rows = await db.collection('contactmessages').find().sort({ created_at: -1 }).limit(500).toArray();
    return rows.map(({ _id, ...m }) => ({ ...m, id: _id.toString() }));
  });
}

export async function updateAdminMessage(id, messageData = {}) {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    await db.collection('contactmessages').updateOne(getQueryById(id), { $set: { is_read: !!messageData.is_read } });
    return { id, is_read: !!messageData.is_read };
  });
}

export async function deleteAdminMessage(id) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.collection('contactmessages').deleteOne(getQueryById(id));
    await logActivity({ action: 'message.deleted', message: 'Deleted a contact message', entity_type: 'message', entity_id: id, actor: admin });
    return { success: true };
  });
}

export async function getAdminUsers() {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const [users, orderStats] = await Promise.all([
      db.collection('users').find({}, { projection: { password: 0 } }).sort({ date_joined: -1 }).toArray(),
      db.collection('orders').aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$user_id', orders: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: [{ $toUpper: '$payment_status' }, 'VERIFIED'] }, { $toDouble: '$total_amount' }, 0] } } } },
      ]).toArray(),
    ]);
    const statsByUser = Object.fromEntries(orderStats.map((s) => [String(s._id), s]));
    return users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      first_name: u.first_name || '',
      is_superuser: !!u.is_superuser,
      is_active: !!u.is_active,
      date_joined: u.date_joined,
      last_login: u.last_login,
      orders: statsByUser[u._id.toString()]?.orders || 0,
      spent: statsByUser[u._id.toString()]?.spent || 0,
    }));
  });
}

export async function setAdminUserActive(id, isActive) {
  return run(async () => {
    const admin = await requireAdmin();
    if (String(id) === admin.id) fail('You cannot disable your own account.');
    const db = await getDb();
    const user = await db.collection('users').findOne(getQueryById(id));
    if (!user) fail('Customer not found.');
    if (user.is_superuser) fail('Admin accounts cannot be disabled here.');
    await db.collection('users').updateOne({ _id: user._id }, { $set: { is_active: !!isActive } });
    await logActivity({ action: isActive ? 'customer.enabled' : 'customer.disabled', message: `${isActive ? 'Enabled' : 'Disabled'} account ${user.email}`, entity_type: 'user', entity_id: id, actor: admin });
    return { success: true };
  });
}

export async function getAdminCarts() {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const carts = await db.collection('carts').find({ 'items.0': { $exists: true } }).sort({ updated_at: -1 }).limit(100).toArray();
    const result = [];
    for (const cart of carts) {
      const owner = await db.collection('users').findOne(getQueryById(cart.user_id), { projection: { email: 1, first_name: 1 } });
      if (!owner) continue;
      const built = await buildCart(db, cart);
      if (!built.items.length) continue;
      result.push({
        id: built.id,
        user: { id: owner._id.toString(), email: owner.email, full_name: owner.first_name || owner.email },
        items: built.items,
        total: built.items.reduce((s, i) => s + i.price * i.quantity, 0),
        updated_at: cart.updated_at,
      });
    }
    return result;
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — emails & activity
// ══════════════════════════════════════════════════════════════════════

function serializeEmailLog(log) {
  return {
    id: log._id.toString(),
    email_type: log.email_type,
    type_label: EMAIL_TYPES[log.email_type]?.label || log.email_type,
    status: log.status,
    subject: log.subject,
    to_email: log.to_email,
    body_text: (log.body_text || '').slice(0, 600),
    backend: log.backend,
    attachment_name: log.attachment_name || '',
    attempts: log.attempts || 1,
    error_message: log.error_message || '',
    queued_at: log.queued_at,
    sent_at: log.sent_at,
    failed_at: log.failed_at,
    order_id: log.order_id,
  };
}

function serializeActivity(a) {
  return {
    id: a._id.toString(),
    action: a.action,
    message: a.message,
    entity_type: a.entity_type,
    entity_id: a.entity_id,
    actor: a.actor || { type: 'system' },
    created_at: a.created_at,
  };
}

export async function getAdminEmailLogs(params = {}) {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const query = {};
    if (params.status) query.status = String(params.status).toUpperCase();
    if (params.type && EMAIL_TYPES[params.type]) query.email_type = params.type;
    if (params.search) {
      const re = new RegExp(escapeRegExp(String(params.search).slice(0, 80)), 'i');
      query.$or = [{ to_email: re }, { subject: re }];
    }
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.page_size) || 25));
    const [total, rows, counts] = await Promise.all([
      db.collection('emaillogs').countDocuments(query),
      db.collection('emaillogs').find(query, { projection: { body_html: 0, attachment_data: 0 } }).sort({ queued_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      db.collection('emaillogs').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
    ]);
    return {
      results: rows.map(serializeEmailLog),
      total,
      counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
      smtp_configured: isSmtpConfigured(),
      types: Object.entries(EMAIL_TYPES).map(([key, v]) => ({ key, label: v.label })),
    };
  });
}

export async function resendAdminEmail(id) {
  return run(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const log = await db.collection('emaillogs').findOne(getQueryById(id));
    if (!log) fail('Email not found.');
    let attachments = [];
    if (log.email_type === 'ORDER_CONFIRMATION' && log.order_id) {
      const order = await loadOrder(log.order_id);
      if (order) attachments = await buildInvoiceAttachment(order);
    }
    try {
      const status = await resendLoggedEmail(log, { attachments });
      await logActivity({ action: 'email.resent', message: `Resent "${log.subject}" to ${log.to_email}`, entity_type: 'order', entity_id: log.order_id, actor: admin });
      return { status };
    } catch (err) {
      fail(err.message);
    }
  });
}

export async function sendAdminTestEmail(to) {
  return run(async () => {
    const admin = await requireAdmin();
    const email = cleanEmail(to || admin.email);
    const id = await deliverEmail({
      type: 'TEST',
      to: email,
      subject: 'Test email from your store',
      html: `<p>If you can read this, email sending is working. 🎉</p><p>${SITE_URL}</p>`,
      force: true,
    });
    const db = await getDb();
    const log = id ? await db.collection('emaillogs').findOne({ _id: id }) : null;
    return { status: log?.status || 'UNKNOWN', error: log?.error_message || '' };
  });
}

export async function getAdminActivity(params = {}) {
  return run(async () => {
    await requireAdmin();
    const db = await getDb();
    const query = {};
    if (params.entity_type) query.entity_type = String(params.entity_type);
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.page_size) || 30));
    const [total, rows] = await Promise.all([
      db.collection('activity_logs').countDocuments(query),
      db.collection('activity_logs').find(query).sort({ created_at: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    return { results: rows.map(serializeActivity), total };
  });
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — settings
// ══════════════════════════════════════════════════════════════════════

export async function getAdminSettings() {
  return run(async () => {
    await requireAdmin();
    return {
      settings: await getSettings(),
      integrations: {
        smtp: isSmtpConfigured(),
        blob: !!process.env.BLOB_READ_WRITE_TOKEN,
        site_url: SITE_URL,
      },
      email_types: Object.entries(EMAIL_TYPES).map(([key, v]) => ({ key, ...v })),
    };
  });
}

function sanitizeSection(section, values) {
  const v = values || {};
  const bool = (x) => !!x;
  switch (section) {
    case 'store':
      return {
        name: cleanText(v.name, { max: 80, required: true, label: 'Store name' }),
        tagline: cleanText(v.tagline, { max: 300 }),
        email: cleanEmail(v.email),
        phone: cleanText(v.phone, { max: 30 }),
        whatsapp: String(v.whatsapp || '').replace(/\D/g, '').slice(0, 15),
        location: cleanText(v.location, { max: 120 }),
        instagram: /^https?:\/\//.test(v.instagram || '') ? cleanText(v.instagram, { max: 200 }) : '',
        youtube: /^https?:\/\//.test(v.youtube || '') ? cleanText(v.youtube, { max: 200 }) : '',
        gstin: cleanText(v.gstin, { max: 20 }).toUpperCase(),
      };
    case 'home': {
      let brandVideos;
      try {
        brandVideos = normalizeVideoList(v.brand_videos, { max: 8 });
      } catch (err) {
        fail(err.message);
      }
      const heroVideoUrl = cleanText(v.hero_video_url, { max: 300 });
      const heroVideoId = heroVideoUrl ? getYouTubeId(heroVideoUrl) : '';
      if (heroVideoUrl && !heroVideoId) fail('Hero video must be a valid YouTube link.');
      return {
        hero_badge: cleanText(v.hero_badge, { max: 60 }),
        hero_title: cleanText(v.hero_title, { max: 80, required: true, label: 'Hero title' }),
        hero_subtitle: cleanText(v.hero_subtitle, { max: 300 }),
        hero_cta_label: cleanText(v.hero_cta_label, { max: 30 }) || 'Shop now',
        hero_video_url: heroVideoUrl,
        hero_video_id: heroVideoId || '',
        announcement: cleanText(v.announcement, { max: 140 }),
        story_title: cleanText(v.story_title, { max: 80 }),
        story_subtitle: cleanText(v.story_subtitle, { max: 200 }),
        brand_videos: brandVideos,
        show_categories: bool(v.show_categories),
        show_new_arrivals: bool(v.show_new_arrivals),
      };
    }
    case 'shipping':
      return {
        flat_fee: cleanNumber(v.flat_fee || 0, { min: 0, max: 5000, integer: true, label: 'Shipping fee' }),
        free_shipping_threshold: cleanNumber(v.free_shipping_threshold || 0, { min: 0, max: 1000000, integer: true, label: 'Free shipping above' }),
        estimated_delivery: cleanText(v.estimated_delivery, { max: 60 }),
      };
    case 'payments': {
      const upiId = String(v.upi_id || '').trim();
      if (upiId && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) fail('UPI ID looks invalid (example: yourname@okaxis).');
      const out = {
        upi_enabled: bool(v.upi_enabled),
        upi_id: upiId,
        upi_payee_name: cleanText(v.upi_payee_name, { max: 60 }),
        cod_enabled: bool(v.cod_enabled),
        cod_fee: cleanNumber(v.cod_fee || 0, { min: 0, max: 1000, integer: true, label: 'COD fee' }),
      };
      if (out.upi_enabled && !out.upi_id) fail('Enter your UPI ID to enable UPI payments.');
      if (!out.upi_enabled && !out.cod_enabled) fail('Keep at least one payment method (UPI or cash on delivery) enabled.');
      return out;
    }
    case 'notifications': {
      const out = {};
      for (const key of Object.keys(DEFAULT_SETTINGS.notifications)) {
        if (key !== 'admin_recipients') out[key] = bool(v[key]);
      }
      const recipients = (Array.isArray(v.admin_recipients) ? v.admin_recipients : String(v.admin_recipients || '').split(/[,\n]/))
        .map((e) => String(e).trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((e) => cleanEmail(e));
      out.admin_recipients = recipients;
      return out;
    }
    case 'reviews':
      return { auto_approve: bool(v.auto_approve) };
    case 'inventory':
      return { low_stock_threshold: cleanNumber(v.low_stock_threshold || 0, { min: 0, max: 1000, integer: true, label: 'Low stock threshold' }) };
    default:
      fail('Unknown settings section.');
  }
}

export async function saveAdminSettings(section, values) {
  return run(async () => {
    const admin = await requireAdmin();
    const clean = sanitizeSection(section, values);
    await saveSettingsSection(section, clean, admin);
    await logActivity({ action: 'settings.updated', message: `Updated ${section} settings`, entity_type: 'settings', entity_id: section, actor: admin });
    invalidate('settings');
    return { ...(await getSettings()), [section]: clean };
  });
}
