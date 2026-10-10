/**
 * Order + payment engine. All money and stock decisions happen here, on the
 * server — the browser only ever sends "which products, how many, ship where,
 * pay how".
 *
 * Order status:   PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED   (or CANCELLED)
 * Payment status: PENDING | RECEIVED (UPI ref submitted, awaiting check) | VERIFIED | FAILED | REFUNDED
 * Payment method: UPI (customer pays our UPI QR, admin checks the UTR) | COD
 */
import crypto from 'crypto';
import { after } from 'next/server';
import { getDb } from '../db';
import {
  fail, nowIso, getQueryById, logActivity, invalidate,
  cleanText, cleanEmail, cleanPhone, cleanPincode, cleanMultiline,
} from './core';
import { getSettings, getPublicSettings, computeCharges } from './settings';
import { effectivePrice, primaryImageOf } from './catalog';
import {
  sendOrderConfirmationEmail, sendOrderStatusEmail, sendPaymentStatusEmail,
  sendAdminNewOrderEmail, sendAdminPaymentReceivedEmail,
} from '../email';

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
export const PAYMENT_STATUSES = ['PENDING', 'RECEIVED', 'VERIFIED', 'FAILED', 'REFUNDED'];
export const PAYMENT_METHODS = ['UPI', 'COD'];

export const STATUS_LABELS = {
  PENDING: 'Order placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being crafted',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_TIMESTAMP = {
  CONFIRMED: 'confirmed_at',
  PROCESSING: 'processing_at',
  SHIPPED: 'shipped_at',
  DELIVERED: 'delivered_at',
  CANCELLED: 'cancelled_at',
};

const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 20;

/** Run work after the response is sent (Vercel keeps the function alive for it). */
function background(label, fn) {
  const task = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[background:${label}]`, err);
    }
  };
  try {
    after(task);
  } catch {
    task();
  }
}

function actorLabel(actor) {
  if (!actor) return 'system';
  if (typeof actor === 'string') return actor;
  return actor.is_superuser ? `admin (${actor.email})` : 'customer';
}

const upper = (v, fallback) => (v ? String(v).toUpperCase() : fallback);

// ── Serialization ──

export function serializeOrder(o, { admin = false, productMap = {} } = {}) {
  const id = o._id.toString();
  const items = (o.items || []).map((item) => {
    const p = productMap[String(item.product_id)];
    const unit = Number(item.unit_price ?? item.price ?? 0);
    const quantity = Number(item.quantity || 1);
    return {
      id: String(item.id || item.product_id),
      product_id: item.product_id ? String(item.product_id) : null,
      variant_id: item.variant_id ? String(item.variant_id) : null,
      name: item.name || p?.name || 'Product (removed)',
      image: item.image || (p ? primaryImageOf(p) : null),
      price: unit,
      quantity,
      line_total: unit * quantity,
    };
  });
  const subtotal = Number(o.subtotal ?? items.reduce((s, i) => s + i.line_total, 0));
  const status = upper(o.status, 'PENDING');
  const paymentMethod = upper(o.payment_method, 'UPI');

  const order = {
    id,
    order_number: o.order_number || `SCS-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    status,
    status_label: STATUS_LABELS[status] || status,
    payment_status: upper(o.payment_status, 'PENDING'),
    payment_method: paymentMethod,
    subtotal,
    shipping_fee: Number(o.shipping_fee || 0),
    cod_fee: Number(o.cod_fee || 0),
    total_amount: Number(o.total_amount || 0),
    items,
    user_id: o.user_id || null,
    customer_name: o.customer_name || '',
    customer_email: o.customer_email || '',
    customer_phone: o.customer_phone || '',
    shipping_address: o.shipping_address || '',
    address_line: o.address_line || '',
    city: o.city || '',
    state: o.state || '',
    pincode: o.pincode || '',
    customer_note: o.customer_note || '',
    payment_reference: o.payment_reference || null,
    upi_transaction_id: o.upi_transaction_id || null,
    screenshot_id: o.screenshot_id || null,
    tracking: o.tracking || null,
    cancel_reason: o.cancel_reason || '',
    timeline: (o.timeline || []).map((t) => ({ ...t, by: admin ? t.by : undefined })),
    created_at: o.created_at,
    updated_at: o.updated_at,
    payment_verified_at: o.payment_verified_at || null,
    confirmed_at: o.confirmed_at || null,
    processing_at: o.processing_at || null,
    shipped_at: o.shipped_at || null,
    delivered_at: o.delivered_at || null,
    cancelled_at: o.cancelled_at || null,
  };

  if (admin) {
    order.admin_note = o.admin_note || '';
    order.needs_attention = o.needs_attention || null;
    order.stock_released = !!o.stock_released;
  }
  return order;
}

/** Bulk-loads products referenced by legacy order items that lack a name/image snapshot. */
async function productMapFor(db, orders) {
  const ids = new Set();
  for (const o of orders) {
    for (const item of o.items || []) {
      if ((!item.name || !item.image) && item.product_id) ids.add(String(item.product_id));
    }
  }
  if (!ids.size) return {};
  const queries = [...ids].map((id) => getQueryById(id));
  const products = await db.collection('products').find({ $or: queries.flatMap((q) => q.$or || [q]) }).toArray();
  const map = {};
  for (const p of products) map[p._id.toString()] = p;
  return map;
}

export async function serializeOrders(db, orders, opts = {}) {
  const productMap = await productMapFor(db, orders);
  return orders.map((o) => serializeOrder(o, { ...opts, productMap }));
}

export async function findOrderDoc(id) {
  const db = await getDb();
  return db.collection('orders').findOne(getQueryById(id));
}

export async function loadOrder(id, opts = {}) {
  const db = await getDb();
  const doc = await db.collection('orders').findOne(getQueryById(id));
  if (!doc) return null;
  const [order] = await serializeOrders(db, [doc], opts);
  return order;
}

// ── Stock ──

async function reserveLine(db, productId, variantId, qty) {
  const res = await db.collection('products').updateOne(
    { _id: productId, variants: { $elemMatch: { id: variantId, stock: { $gte: qty } } } },
    { $inc: { 'variants.$.stock': -qty } }
  );
  return res.modifiedCount === 1;
}

async function restockLines(db, lines) {
  for (const line of lines) {
    const vid = line.variant_id;
    // Legacy (Django-migrated) variants may have numeric ids.
    const variantMatch = /^\d+$/.test(String(vid)) ? { $in: [String(vid), Number(vid)] } : vid;
    await db.collection('products').updateOne(
      { ...getQueryById(line.product_id), 'variants.id': variantMatch },
      { $inc: { 'variants.$.stock': Number(line.quantity) } }
    );
  }
}

/** Puts an order's items back on the shelf — exactly once per order. */
async function releaseOrderStock(db, orderDoc) {
  const claimed = await db.collection('orders').findOneAndUpdate(
    { _id: orderDoc._id, stock_released: { $ne: true } },
    { $set: { stock_released: true } }
  );
  if (!claimed) return false;
  // Legacy orders (before stock reservation existed) never reserved stock properly.
  if (orderDoc.stock_reserved === false) return false;
  await restockLines(db, (orderDoc.items || []).filter((i) => i.product_id && i.variant_id));
  invalidate('products');
  return true;
}

// ── Placement ──

async function generateOrderNumber(db) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (let i = 0; i < 5; i++) {
    const candidate = `SCS-${ymd}-${crypto.randomInt(1000, 9999)}`;
    const exists = await db.collection('orders').findOne({ order_number: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  return `SCS-${ymd}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function cleanUtr(value) {
  const utr = String(value ?? '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z0-9]{10,22}$/.test(utr)) {
    fail('Please enter the 12-digit UPI transaction ID / UTR shown in your UPI app after paying.');
  }
  return utr;
}

export async function placeOrder(user, input) {
  const db = await getDb();
  const settings = await getSettings();
  const pub = await getPublicSettings();

  // Idempotency: a double-tap on "Place order" returns the same order.
  const clientRef = cleanText(input.client_ref, { max: 64 });
  if (clientRef) {
    const existing = await db.collection('orders').findOne({ user_id: user.id, client_ref: clientRef });
    if (existing) {
      return { order: serializeOrder(existing) };
    }
  }

  const method = String(input.payment_method || '').toUpperCase();
  if (method === 'UPI' && !pub.payments.upi) fail('UPI payment is not available right now. Please choose another method.');
  if (method === 'COD' && !pub.payments.cod) fail('Cash on delivery is not available.');
  if (!PAYMENT_METHODS.includes(method)) fail('Please choose a payment method.');

  const customer = {
    customer_name: cleanText(input.customer_name, { max: 80, required: true, label: 'Full name' }),
    customer_email: cleanEmail(input.customer_email),
    customer_phone: cleanPhone(input.customer_phone),
    address_line: cleanText(input.address, { max: 300, required: true, label: 'Address' }),
    city: cleanText(input.city, { max: 60, required: true, label: 'City' }),
    state: cleanText(input.state, { max: 60, required: true, label: 'State' }),
    pincode: cleanPincode(input.pincode),
    customer_note: cleanMultiline(input.customer_note, { max: 500, label: 'Order note' }),
  };
  const shipping_address = `${customer.address_line}, ${customer.city}, ${customer.state} - ${customer.pincode}`;

  let upi_transaction_id = null;
  let screenshot_id = null;
  if (method === 'UPI') {
    upi_transaction_id = cleanUtr(input.upi_transaction_id);
    const dup = await db.collection('orders').findOne({ upi_transaction_id, status: { $ne: 'CANCELLED' } }, { projection: { _id: 1 } });
    if (dup) fail('This UPI transaction ID is already used on another order. Please check the ID.');
    const shot = String(input.screenshot_id || '');
    screenshot_id = shot.startsWith('/api/media/screenshots/') ? shot : null;
  }

  // Merge duplicate lines and sanity-check quantities.
  const wanted = new Map();
  for (const raw of Array.isArray(input.items) ? input.items : []) {
    const pid = String(raw?.product_id || '').trim();
    const qty = Math.floor(Number(raw?.quantity));
    if (!pid || !Number.isFinite(qty) || qty < 1) continue;
    wanted.set(pid, Math.min(MAX_QTY_PER_LINE, (wanted.get(pid) || 0) + qty));
  }
  if (!wanted.size) fail('Your cart is empty.');
  if (wanted.size > MAX_LINES) fail(`You can order at most ${MAX_LINES} different items at once.`);

  // Reserve stock atomically, line by line; undo everything on the first failure.
  const reserved = [];
  const lines = [];
  try {
    for (const [pid, qty] of wanted) {
      const p = await db.collection('products').findOne(getQueryById(pid));
      if (!p || !p.is_active) fail(`"${p?.name || 'An item in your cart'}" is no longer available. Please remove it from your cart.`);
      const variant = (p.variants || [])[0];
      if (!variant) fail(`"${p.name}" is not available right now.`);

      const ok = await reserveLine(db, p._id, variant.id, qty);
      if (!ok) {
        const left = Math.max(0, Number(variant.stock || 0));
        fail(left > 0 ? `Only ${left} of "${p.name}" left in stock. Please reduce the quantity.` : `"${p.name}" just sold out. Please remove it from your cart.`);
      }
      reserved.push({ product_id: p._id.toString(), variant_id: variant.id, quantity: qty });

      const unit = effectivePrice(variant.price_override || p.base_price, p.discount);
      lines.push({
        id: crypto.randomUUID(),
        product_id: p._id.toString(),
        variant_id: String(variant.id),
        name: p.name,
        image: primaryImageOf(p),
        mrp: Number(variant.price_override || p.base_price || 0),
        unit_price: unit,
        price: unit,
        quantity: qty,
      });
    }
  } catch (err) {
    await restockLines(db, reserved);
    throw err;
  }

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const charges = computeCharges(settings, subtotal, method);
  const now = nowIso();
  const orderId = crypto.randomUUID();
  const order_number = await generateOrderNumber(db);

  const timeline = [{ at: now, type: 'status', status: 'PENDING', label: 'Order placed', by: 'customer' }];
  if (method === 'UPI') timeline.push({ at: now, type: 'payment', status: 'RECEIVED', label: `UPI reference submitted (${upi_transaction_id})`, by: 'customer' });

  const doc = {
    _id: orderId,
    order_number,
    client_ref: clientRef || null,
    user_id: user.id,
    ...customer,
    shipping_address,
    items: lines,
    subtotal,
    shipping_fee: charges.shippingFee,
    cod_fee: charges.codFee,
    total_amount: charges.total,
    payment_method: method,
    payment_status: method === 'UPI' ? 'RECEIVED' : 'PENDING',
    status: 'PENDING',
    payment_reference: order_number,
    upi_transaction_id,
    screenshot_id,
    stock_reserved: true,
    stock_released: false,
    tracking: null,
    timeline,
    created_at: now,
    updated_at: now,
    payment_verified_at: null,
    confirmed_at: null,
    processing_at: null,
    shipped_at: null,
    delivered_at: null,
    cancelled_at: null,
  };

  await db.collection('orders').insertOne(doc);

  await db.collection('carts').updateOne({ user_id: user.id }, { $set: { items: [], updated_at: now } });
  invalidate('products');

  const order = serializeOrder(doc);
  await logActivity({
    action: 'order.placed',
    message: `Order ${order_number} placed — ₹${doc.total_amount} via ${method}`,
    entity_type: 'order',
    entity_id: orderId,
    actor: user,
  });

  background('order-placed-emails', async () => {
    await sendOrderConfirmationEmail(order);
    await sendAdminNewOrderEmail(order);
    if (method === 'UPI') await sendAdminPaymentReceivedEmail(order);
  });

  return { order };
}

// ── Payment state changes ──

/**
 * Marks an order paid (admin verified the UPI payment, or COD cash collected).
 * Safe against double clicks — only the first call changes anything and emails.
 */
export async function markOrderPaid(orderDoc, { source = 'admin', actor = null, notify = 'payment' } = {}) {
  const db = await getDb();
  const now = nowIso();
  const fresh = await db.collection('orders').findOne({ _id: orderDoc._id });
  if (!fresh || upper(fresh.payment_status) === 'VERIFIED') return false;

  const set = {
    payment_status: 'VERIFIED',
    payment_verified_at: now,
    updated_at: now,
  };
  const timeline = [{ at: now, type: 'payment', status: 'VERIFIED', label: source === 'admin' ? 'Payment verified' : 'Payment received', by: actorLabel(actor || source) }];
  if (upper(fresh.status, 'PENDING') === 'PENDING') {
    set.status = 'CONFIRMED';
    set.confirmed_at = now;
    timeline.push({ at: now, type: 'status', status: 'CONFIRMED', label: 'Order confirmed', by: 'system' });
  }

  const res = await db.collection('orders').updateOne(
    { _id: fresh._id, payment_status: { $ne: 'VERIFIED' } },
    { $set: set, $push: { timeline: { $each: timeline } } }
  );
  if (res.modifiedCount !== 1) return false;

  const order = await loadOrder(fresh._id);
  await logActivity({
    action: 'payment.verified',
    message: `Payment of ₹${order.total_amount} verified for ${order.order_number}${order.upi_transaction_id ? ` (UTR ${order.upi_transaction_id})` : ''}`,
    entity_type: 'order',
    entity_id: order.id,
    actor: actor || source,
  });

  background('order-paid-emails', async () => {
    if (notify === 'confirmation') {
      await sendOrderConfirmationEmail(order);
      await sendAdminNewOrderEmail(order);
    } else if (notify === 'payment') {
      await sendPaymentStatusEmail(order);
    }
  });
  return true;
}

// ── Status changes ──

/**
 * Moves an order to a new fulfilment status.
 * actor: admin user object, 'customer', or 'system'.
 */
export async function changeOrderStatus(orderId, nextStatus, actor, { tracking = null, cancel_reason = '', note = '', notify = true } = {}) {
  const db = await getDb();
  const doc = await db.collection('orders').findOne(getQueryById(orderId));
  if (!doc) fail('Order not found.');

  const next = String(nextStatus || '').toUpperCase();
  if (!ORDER_STATUSES.includes(next)) fail('Unknown order status.');
  const current = upper(doc.status, 'PENDING');
  if (current === 'CANCELLED') fail('This order is cancelled and cannot be changed. Ask the customer to place a new order.');
  if (current === 'DELIVERED' && next === 'CANCELLED') fail('A delivered order cannot be cancelled. Mark the payment as refunded instead if you returned the money.');

  const now = nowIso();
  const set = { status: next, updated_at: now };
  const tsField = STATUS_TIMESTAMP[next];
  if (tsField) set[tsField] = now;
  if (tracking) {
    set.tracking = {
      courier: cleanText(tracking.courier, { max: 60 }),
      tracking_number: cleanText(tracking.tracking_number, { max: 60 }),
      tracking_url: /^https?:\/\//i.test(String(tracking.tracking_url || '')) ? cleanText(tracking.tracking_url, { max: 300 }) : '',
    };
  }
  if (next === 'CANCELLED') set.cancel_reason = cleanText(cancel_reason, { max: 300 }) || 'Cancelled';

  const timeline = [];
  if (next !== current) {
    timeline.push({
      at: now,
      type: 'status',
      status: next,
      label: next === 'CANCELLED' ? `Cancelled — ${set.cancel_reason}` : STATUS_LABELS[next],
      by: actorLabel(actor),
    });
  } else if (tracking) {
    timeline.push({ at: now, type: 'note', label: 'Tracking details updated', by: actorLabel(actor) });
  }
  if (note) timeline.push({ at: now, type: 'note', label: cleanText(note, { max: 300 }), by: actorLabel(actor) });

  // COD is paid at the door.
  const codPaid = next === 'DELIVERED' && upper(doc.payment_method) === 'COD' && upper(doc.payment_status) !== 'VERIFIED';
  if (codPaid) {
    set.payment_status = 'VERIFIED';
    set.payment_verified_at = now;
    timeline.push({ at: now, type: 'payment', status: 'VERIFIED', label: 'Cash collected on delivery', by: actorLabel(actor) });
  }

  await db.collection('orders').updateOne({ _id: doc._id }, { $set: set, ...(timeline.length ? { $push: { timeline: { $each: timeline } } } : {}) });

  if (next === 'CANCELLED') await releaseOrderStock(db, doc);

  const order = await loadOrder(doc._id);
  if (next !== current) {
    await logActivity({
      action: 'order.status_changed',
      message: `${order.order_number}: ${current} → ${next}${next === 'CANCELLED' ? ` (${set.cancel_reason})` : ''}`,
      entity_type: 'order',
      entity_id: order.id,
      actor: typeof actor === 'object' ? actor : actor,
    });
    if (notify) background('order-status-email', () => sendOrderStatusEmail(order));
  } else if (tracking) {
    await logActivity({ action: 'order.tracking_updated', message: `${order.order_number}: tracking updated`, entity_type: 'order', entity_id: order.id, actor });
  }
  return order;
}

/** Admin-driven payment status change (UPI verification, refunds, failures). */
export async function changePaymentStatus(orderId, nextPaymentStatus, actor, { note = '', notify = true } = {}) {
  const db = await getDb();
  const doc = await db.collection('orders').findOne(getQueryById(orderId));
  if (!doc) fail('Order not found.');
  const next = String(nextPaymentStatus || '').toUpperCase();
  if (!PAYMENT_STATUSES.includes(next)) fail('Unknown payment status.');
  const current = upper(doc.payment_status, 'PENDING');
  if (next === current) return loadOrder(doc._id, { admin: true });

  if (next === 'VERIFIED') {
    if (upper(doc.status) === 'CANCELLED') fail('This order is cancelled. If the customer paid, refund them from your UPI app and mark the payment as refunded.');
    await markOrderPaid(doc, { source: 'admin', actor, notify: notify ? 'payment' : 'none' });
    if (note) {
      await db.collection('orders').updateOne({ _id: doc._id }, { $push: { timeline: { at: nowIso(), type: 'note', label: cleanText(note, { max: 300 }), by: actorLabel(actor) } } });
    }
    return loadOrder(doc._id, { admin: true });
  }

  const now = nowIso();
  const labels = { FAILED: 'Payment marked as failed', REFUNDED: 'Payment refunded', PENDING: 'Payment reset to pending', RECEIVED: 'Payment marked as received' };
  await db.collection('orders').updateOne(
    { _id: doc._id },
    {
      $set: { payment_status: next, updated_at: now, ...(next === 'REFUNDED' ? { refunded_at: now, needs_attention: null } : {}) },
      $push: { timeline: { at: now, type: 'payment', status: next, label: note ? `${labels[next]} — ${cleanText(note, { max: 300 })}` : labels[next], by: actorLabel(actor) } },
    }
  );
  const order = await loadOrder(doc._id, { admin: true });
  await logActivity({
    action: 'payment.status_changed',
    message: `${order.order_number}: payment ${current} → ${next}`,
    entity_type: 'order',
    entity_id: order.id,
    actor,
  });
  if (notify && ['FAILED', 'REFUNDED'].includes(next)) background('payment-status-email', () => sendPaymentStatusEmail(order));
  return order;
}
