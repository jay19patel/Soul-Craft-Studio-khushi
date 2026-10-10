/**
 * Transactional email.
 *
 * Every attempt is written to the `emaillogs` collection with an honest status:
 *   SENT       — accepted by the SMTP server
 *   FAILED     — SMTP rejected it (error_message says why; admin can resend)
 *   SIMULATED  — SMTP is not configured, nothing actually left the server
 *   SKIPPED    — this email type is switched off in Admin → Settings → Notifications
 */
import nodemailer from 'nodemailer';
import { getDb } from './db';
import { generateInvoicePdf } from './pdf';
import { getSettings } from './server/settings';
import { escapeHtml } from './server/core';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL || SMTP_USER || 'info@soulcraftstudio.in';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://soulcraftstudio.vercel.app').replace(/\/$/, '');

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export const isSmtpConfigured = () => !!transporter;

/** Email type → settings toggle + human label (used by the admin UI too). */
export const EMAIL_TYPES = {
  WELCOME: { setting: 'welcome', label: 'Welcome (new account)', audience: 'customer' },
  ORDER_CONFIRMATION: { setting: 'order_confirmation', label: 'Order confirmation + invoice', audience: 'customer' },
  ORDER_STATUS: { setting: 'order_status', label: 'Order status updates', audience: 'customer' },
  PAYMENT_STATUS: { setting: 'payment_status', label: 'Payment status updates', audience: 'customer' },
  ADMIN_NEW_ORDER: { setting: 'admin_new_order', label: 'New order alert', audience: 'admin' },
  ADMIN_PAYMENT_RECEIVED: { setting: 'admin_payment_received', label: 'UPI payment to verify', audience: 'admin' },
  ADMIN_CONTACT_MESSAGE: { setting: 'admin_contact_message', label: 'New contact message', audience: 'admin' },
};

const stripHtml = (html) => String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

async function writeLog(doc) {
  try {
    const db = await getDb();
    const res = await db.collection('emaillogs').insertOne(doc);
    return res.insertedId;
  } catch (e) {
    console.error('Failed to write email log:', e);
    return null;
  }
}

/**
 * Sends (or skips/simulates) one email and records the outcome.
 * `force` bypasses the settings toggle — used for manual resends by the admin.
 */
export async function deliverEmail({ type, to, subject, html, attachments = [], user_id = null, order_id = null, force = false }) {
  const recipients = (Array.isArray(to) ? to : [to]).map((r) => String(r || '').trim()).filter(Boolean);
  const now = new Date().toISOString();
  const base = {
    email_type: type,
    subject,
    from_email: DEFAULT_FROM_EMAIL,
    to_email: recipients.join(', '),
    body_html: html,
    body_text: stripHtml(html),
    attachment_name: attachments[0]?.filename || '',
    attempts: 1,
    queued_at: now,
    user_id: user_id ? String(user_id) : null,
    order_id: order_id ? String(order_id) : null,
  };

  if (!recipients.length) {
    return writeLog({ ...base, status: 'SKIPPED', backend: 'none', error_message: 'No recipient address.', sent_at: null, failed_at: null });
  }

  if (!force) {
    const settings = await getSettings();
    const toggle = EMAIL_TYPES[type]?.setting;
    if (toggle && settings.notifications[toggle] === false) {
      return writeLog({ ...base, status: 'SKIPPED', backend: 'none', error_message: 'Disabled in Settings → Notifications.', sent_at: null, failed_at: null });
    }
  }

  if (!transporter) {
    console.log(`[Simulated email] ${type} → ${base.to_email} | ${subject}`);
    return writeLog({ ...base, status: 'SIMULATED', backend: 'simulated', error_message: 'SMTP is not configured — email was not sent.', sent_at: null, failed_at: null });
  }

  try {
    await transporter.sendMail({ from: DEFAULT_FROM_EMAIL, to: recipients, subject, html, attachments });
    return writeLog({ ...base, status: 'SENT', backend: 'smtp', error_message: '', sent_at: new Date().toISOString(), failed_at: null });
  } catch (err) {
    console.error(`SMTP ${type} email failed:`, err);
    return writeLog({ ...base, status: 'FAILED', backend: 'smtp', error_message: String(err.message || err).slice(0, 500), sent_at: null, failed_at: new Date().toISOString() });
  }
}

/** Re-sends a logged email (same body). Updates that log row in place. */
export async function resendLoggedEmail(log, { attachments = [] } = {}) {
  const db = await getDb();
  const recipients = String(log.to_email || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) throw new Error('This email has no recipient.');
  if (!transporter) throw new Error('SMTP is not configured, so emails cannot be sent. Add SMTP_* environment variables first.');

  const now = new Date().toISOString();
  try {
    await transporter.sendMail({ from: DEFAULT_FROM_EMAIL, to: recipients, subject: log.subject, html: log.body_html, attachments });
    await db.collection('emaillogs').updateOne(
      { _id: log._id },
      { $set: { status: 'SENT', backend: 'smtp', error_message: '', sent_at: now }, $inc: { attempts: 1 } }
    );
    return 'SENT';
  } catch (err) {
    await db.collection('emaillogs').updateOne(
      { _id: log._id },
      { $set: { status: 'FAILED', error_message: String(err.message || err).slice(0, 500), failed_at: now }, $inc: { attempts: 1 } }
    );
    throw new Error(`Resend failed: ${err.message}`);
  }
}

// ── Templates ──

function layout(storeName, inner) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#302d2a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ee;padding:24px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece6dc">
    <tr><td style="background:#1e1b4b;padding:20px 28px;text-align:center">
      <div style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:1px">${escapeHtml(storeName)}</div>
      <div style="font-size:10px;color:#fdba74;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Handcrafted with love</div>
    </td></tr>
    <tr><td style="padding:28px">${inner}</td></tr>
    <tr><td style="padding:16px 28px;background:#faf8f5;font-size:11px;color:#8a837a;text-align:center">
      You received this email because of activity on <a href="${SITE_URL}" style="color:#c2410c">${escapeHtml(storeName)}</a>.
    </td></tr>
  </table></td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;font-size:14px">${escapeHtml(label)}</a>`;

function itemsTable(order) {
  const rows = (order.items || [])
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:14px">${escapeHtml(i.name)} <span style="color:#8a837a">× ${Number(i.quantity)}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:14px;text-align:right">${money(Number(i.price) * Number(i.quantity))}</td>
      </tr>`
    )
    .join('');
  const extra = [
    ['Subtotal', order.subtotal],
    Number(order.shipping_fee) > 0 ? ['Shipping', order.shipping_fee] : ['Shipping', 'Free'],
    Number(order.cod_fee) > 0 ? ['COD charge', order.cod_fee] : null,
  ]
    .filter(Boolean)
    .map(
      ([label, value]) => `<tr><td style="padding:6px 0;font-size:13px;color:#6b645c">${label}</td><td style="padding:6px 0;font-size:13px;text-align:right;color:#6b645c">${typeof value === 'number' || /^\d/.test(String(value)) ? money(value) : value}</td></tr>`
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}${extra}
    <tr><td style="padding:10px 0;font-weight:bold;font-size:15px">Total</td><td style="padding:10px 0;font-weight:bold;font-size:15px;text-align:right;color:#c2410c">${money(order.total_amount)}</td></tr>
  </table>`;
}

const PAYMENT_METHOD_LABEL = { UPI: 'UPI (manual verification)', COD: 'Cash on Delivery' };

const STATUS_COPY = {
  CONFIRMED: 'Your order is confirmed and in our crafting queue.',
  PROCESSING: 'We are hand-crafting and packing your order right now.',
  SHIPPED: 'Your order is on its way!',
  DELIVERED: 'Your order has been delivered. We hope you love it!',
  CANCELLED: 'Your order has been cancelled. If you already paid, the refund will be processed to your original payment method.',
  PENDING: 'Your order is awaiting payment confirmation.',
};

const orderLink = (order) => `${SITE_URL}/orders/${encodeURIComponent(order.id)}`;

// ── Customer emails ──

export async function sendWelcomeEmail(user) {
  const { store } = await getSettings();
  const html = layout(
    store.name,
    `<h2 style="margin:0 0 12px">Welcome, ${escapeHtml(user.full_name || 'friend')}!</h2>
     <p style="line-height:1.6">Your account at ${escapeHtml(store.name)} is ready. Explore handcrafted wool art made one loop at a time.</p>
     <p style="margin-top:20px">${button(`${SITE_URL}/shop`, 'Start shopping')}</p>`
  );
  return deliverEmail({ type: 'WELCOME', to: user.email, subject: `Welcome to ${store.name}`, html, user_id: user.id });
}

export async function buildInvoiceAttachment(order) {
  try {
    const pdf = await generateInvoicePdf(order);
    return [{ filename: `Invoice-${order.order_number || order.id}.pdf`, content: pdf, contentType: 'application/pdf' }];
  } catch (err) {
    console.error('Failed to generate invoice PDF:', err);
    return [];
  }
}

export async function sendOrderConfirmationEmail(order) {
  const { store } = await getSettings();
  const paymentLine =
    order.payment_method === 'COD'
      ? 'Please keep the amount ready at delivery.'
      : order.payment_status === 'VERIFIED'
        ? 'Payment received — thank you!'
        : 'We will confirm as soon as your payment is verified.';
  const html = layout(
    store.name,
    `<h2 style="margin:0 0 8px">Thank you for your order!</h2>
     <p style="line-height:1.6">Hi ${escapeHtml(order.customer_name || 'there')}, we have received order <strong>${escapeHtml(order.order_number)}</strong>. ${paymentLine}</p>
     ${itemsTable(order)}
     <p style="font-size:13px;color:#6b645c;line-height:1.6"><strong>Payment:</strong> ${PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method}<br/>
     <strong>Ship to:</strong> ${escapeHtml(order.shipping_address)}</p>
     <p style="margin-top:20px">${button(orderLink(order), 'Track your order')}</p>
     <p style="font-size:12px;color:#8a837a;margin-top:16px">Your invoice is attached as a PDF.</p>`
  );
  return deliverEmail({
    type: 'ORDER_CONFIRMATION',
    to: order.customer_email,
    subject: `Order ${order.order_number} received | ${store.name}`,
    html,
    attachments: await buildInvoiceAttachment(order),
    user_id: order.user_id,
    order_id: order.id,
  });
}

export async function sendOrderStatusEmail(order) {
  const { store } = await getSettings();
  const tracking = order.tracking || {};
  const trackingHtml =
    order.status === 'SHIPPED' && (tracking.courier || tracking.tracking_number)
      ? `<p style="background:#f6f3ee;padding:12px 16px;border-radius:10px;font-size:14px;line-height:1.6">
          ${tracking.courier ? `<strong>Courier:</strong> ${escapeHtml(tracking.courier)}<br/>` : ''}
          ${tracking.tracking_number ? `<strong>Tracking no.:</strong> ${escapeHtml(tracking.tracking_number)}<br/>` : ''}
          ${tracking.tracking_url && /^https?:\/\//.test(tracking.tracking_url) ? `<a href="${escapeHtml(tracking.tracking_url)}" style="color:#c2410c">Track shipment →</a>` : ''}
        </p>`
      : '';
  const html = layout(
    store.name,
    `<h2 style="margin:0 0 8px">Order ${escapeHtml(order.order_number)}: ${escapeHtml(order.status_label || order.status)}</h2>
     <p style="line-height:1.6">Hi ${escapeHtml(order.customer_name || 'there')}, ${STATUS_COPY[order.status] || 'your order status has been updated.'}</p>
     ${trackingHtml}
     <p style="margin-top:20px">${button(orderLink(order), 'View order')}</p>`
  );
  return deliverEmail({
    type: 'ORDER_STATUS',
    to: order.customer_email,
    subject: `Order ${order.order_number} — ${order.status_label || order.status} | ${store.name}`,
    html,
    user_id: order.user_id,
    order_id: order.id,
  });
}

export async function sendPaymentStatusEmail(order) {
  const { store } = await getSettings();
  const copy = {
    VERIFIED: `We have received your payment of <strong>${money(order.total_amount)}</strong>. Your order is confirmed.`,
    FAILED: 'We could not verify your payment. Please check the transaction details or contact us — you can retry payment from your order page.',
    REFUNDED: `A refund of <strong>${money(order.total_amount)}</strong> has been initiated to your original payment method.`,
    RECEIVED: 'We have received your payment details and will verify them shortly.',
  }[order.payment_status] || `Payment status: ${escapeHtml(order.payment_status)}`;
  const html = layout(
    store.name,
    `<h2 style="margin:0 0 8px">Payment update for ${escapeHtml(order.order_number)}</h2>
     <p style="line-height:1.6">Hi ${escapeHtml(order.customer_name || 'there')}, ${copy}</p>
     <p style="margin-top:20px">${button(orderLink(order), 'View order')}</p>`
  );
  return deliverEmail({
    type: 'PAYMENT_STATUS',
    to: order.customer_email,
    subject: `Payment ${String(order.payment_status).toLowerCase()} — ${order.order_number} | ${store.name}`,
    html,
    user_id: order.user_id,
    order_id: order.id,
  });
}

// ── Admin alerts ──

async function adminRecipients() {
  const settings = await getSettings();
  const list = (settings.notifications.admin_recipients || []).filter(Boolean);
  return list.length ? list : [settings.store.email].filter(Boolean);
}

export async function sendAdminNewOrderEmail(order) {
  const { store } = await getSettings();
  const html = layout(
    store.name,
    `<h2 style="margin:0 0 8px">New order ${escapeHtml(order.order_number)} 🎉</h2>
     <p style="line-height:1.6"><strong>${escapeHtml(order.customer_name)}</strong> (${escapeHtml(order.customer_email)}, ${escapeHtml(order.customer_phone || '-')})<br/>
     Payment: ${PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method} — <strong>${escapeHtml(order.payment_status)}</strong></p>
     ${itemsTable(order)}
     <p style="font-size:13px;color:#6b645c">Ship to: ${escapeHtml(order.shipping_address)}</p>
     <p style="margin-top:20px">${button(`${SITE_URL}/admin/orders/${encodeURIComponent(order.id)}`, 'Open in admin')}</p>`
  );
  return deliverEmail({
    type: 'ADMIN_NEW_ORDER',
    to: await adminRecipients(),
    subject: `New order ${order.order_number} — ${money(order.total_amount)}`,
    html,
    order_id: order.id,
  });
}

export async function sendAdminPaymentReceivedEmail(order) {
  const { store } = await getSettings();
  const html = layout(
    store.name,
    `<h2 style="margin:0 0 8px">UPI payment to verify</h2>
     <p style="line-height:1.6">Order <strong>${escapeHtml(order.order_number)}</strong> — ${money(order.total_amount)}<br/>
     UTR / Transaction ID: <strong>${escapeHtml(order.upi_transaction_id || '-')}</strong></p>
     <p style="line-height:1.6">Check your UPI app / bank statement for this UTR, then mark the payment as verified.</p>
     <p style="margin-top:20px">${button(`${SITE_URL}/admin/orders/${encodeURIComponent(order.id)}`, 'Verify payment')}</p>`
  );
  return deliverEmail({
    type: 'ADMIN_PAYMENT_RECEIVED',
    to: await adminRecipients(),
    subject: `Verify UPI payment — ${order.order_number}`,
    html,
    order_id: order.id,
  });
}

export async function sendAdminContactMessageEmail(message) {
  const { store } = await getSettings();
  const html = layout(
    store.name,
    `<h2 style="margin:0 0 8px">New message: ${escapeHtml(message.subject || 'Contact form')}</h2>
     <p style="line-height:1.6"><strong>${escapeHtml(message.name)}</strong> &lt;${escapeHtml(message.email)}&gt;</p>
     <p style="white-space:pre-wrap;line-height:1.6;background:#f6f3ee;padding:12px 16px;border-radius:10px">${escapeHtml(message.message)}</p>
     <p style="margin-top:20px">${button(`${SITE_URL}/admin/messages`, 'Open inbox')}</p>`
  );
  return deliverEmail({ type: 'ADMIN_CONTACT_MESSAGE', to: await adminRecipients(), subject: `New message from ${message.name}`, html });
}
