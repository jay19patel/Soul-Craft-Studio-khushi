/**
 * Server-only building blocks shared by every server action / route handler.
 * Nothing in here is a server action itself — only lib/serverActions.js
 * exposes functions to the browser.
 */
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getDb } from '../db';
import { verifyToken } from '../auth';

/** An error whose message is safe (and useful) to show the customer/admin. */
export class PublicError extends Error {}

export const fail = (message) => {
  throw new PublicError(message);
};

/**
 * Runs a server-action body and converts the outcome into a plain object.
 * Next.js strips thrown error messages in production builds, so actions
 * return `{ ok, data | error }` and lib/api.js turns that back into a throw
 * on the client with the real message.
 */
export async function run(fn) {
  try {
    const raw = await fn();
    const data = raw === undefined ? null : JSON.parse(JSON.stringify(raw));
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PublicError) return { ok: false, error: err.message };
    console.error('[server action]', err);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

export const nowIso = () => new Date().toISOString();

export function getQueryById(id) {
  if (id === null || id === undefined || id === '') return { _id: null };
  const idStr = String(id);
  if (ObjectId.isValid(idStr) && idStr.length === 24) {
    return { $or: [{ _id: idStr }, { _id: new ObjectId(idStr) }] };
  }
  return { _id: idStr };
}

export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

// ── Cache tags ──
// `{ expire: 0 }` expires immediately so shoppers see admin edits on the next request.
export function invalidate(...tags) {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (err) {
      console.error('Failed to revalidate tag', tag, err);
    }
  }
}

// ── Input helpers ──

export function cleanText(value, { max = 500, required = false, label = 'This field' } = {}) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (required && !text) fail(`${label} is required.`);
  if (text.length > max) fail(`${label} must be at most ${max} characters.`);
  return text;
}

export function cleanMultiline(value, { max = 5000, required = false, label = 'This field' } = {}) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (required && !text) fail(`${label} is required.`);
  if (text.length > max) fail(`${label} must be at most ${max} characters.`);
  return text;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function cleanEmail(value, { required = true } = {}) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) {
    if (required) fail('Email is required.');
    return '';
  }
  if (!EMAIL_RE.test(email) || email.length > 254) fail('Please enter a valid email address.');
  return email;
}

/** Indian mobile number → 10 digits (accepts +91 / 0 prefixes, spaces, dashes). */
export function cleanPhone(value, { required = true } = {}) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!digits) {
    if (required) fail('Phone number is required.');
    return '';
  }
  if (!/^[6-9]\d{9}$/.test(digits)) fail('Please enter a valid 10-digit mobile number.');
  return digits;
}

export function cleanPincode(value) {
  const pin = String(value ?? '').replace(/\s/g, '');
  if (!/^[1-9]\d{5}$/.test(pin)) fail('Please enter a valid 6-digit pincode.');
  return pin;
}

export function cleanNumber(value, { min = 0, max = 10_000_000, label = 'Value', integer = false } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) fail(`${label} must be a number.`);
  if (num < min || num > max) fail(`${label} must be between ${min} and ${max}.`);
  return integer ? Math.round(num) : num;
}

// ── Auth ──

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload?.id) return null;

  const db = await getDb();
  const user = await db.collection('users').findOne(getQueryById(payload.id));
  if (!user || !user.is_active) return null;

  // Tokens issued before the last password change are no longer valid.
  if (user.password_changed_at && payload.iat && payload.iat * 1000 < new Date(user.password_changed_at).getTime() - 1000) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    full_name: user.first_name || '',
    is_superuser: !!user.is_superuser,
  };
}

export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (!user) fail('Please log in to continue.');
  return user;
}

export async function requireAdmin() {
  const user = await getAuthenticatedUser();
  if (!user || !user.is_superuser) fail('You are not allowed to do this.');
  return user;
}

// ── Activity log ──
// Every admin change, payment event and automatic system action lands here so
// the store owner can always answer "who changed what, and when?".

export async function logActivity({ action, message, entity_type = null, entity_id = null, actor = null, meta = null }) {
  try {
    const db = await getDb();
    await db.collection('activity_logs').insertOne({
      action,
      message,
      entity_type,
      entity_id: entity_id ? String(entity_id) : null,
      actor: actor
        ? typeof actor === 'string'
          ? { type: actor }
          : { type: actor.is_superuser ? 'admin' : 'customer', id: actor.id, email: actor.email }
        : { type: 'system' },
      meta,
      created_at: nowIso(),
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}
