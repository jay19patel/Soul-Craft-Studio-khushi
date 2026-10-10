/**
 * Store settings — a single document that the admin edits from
 * /admin/settings and /admin/homepage. Everything the owner might want to
 * change without a code deploy lives here.
 */
import { unstable_cache } from 'next/cache';
import { getDb } from '../db';

const SETTINGS_ID = 'store';

export const DEFAULT_SETTINGS = {
  store: {
    name: 'Soul Craft Studio',
    tagline: 'Handcrafted with love, knitted with passion. Discover our exclusive collection of wool art, decorations, and unique keychains that tell a story.',
    email: 'Khushipatelpatel112@gmail.com',
    phone: '+91 90238 96348',
    whatsapp: '919023896348',
    location: 'Valsad, Gujarat',
    instagram: 'https://www.instagram.com/craftyyy111',
    youtube: '',
    gstin: '',
  },
  home: {
    hero_badge: '100% Handcrafted Woolen Art',
    hero_title: 'Soul Craft Studio',
    hero_subtitle: 'Handcrafted with love, knitted with passion. Wool art, decor and keychains that tell a story.',
    hero_cta_label: 'Shop Collections',
    hero_video_url: '',
    hero_video_id: '',
    announcement: '',
    story_title: 'Behind the craft',
    story_subtitle: 'Watch how every piece is made — loop by loop, by hand.',
    brand_videos: [],
    show_categories: true,
    show_new_arrivals: true,
  },
  shipping: {
    flat_fee: 0,
    free_shipping_threshold: 0,
    estimated_delivery: '5-7 business days',
  },
  payments: {
    upi_enabled: true,
    upi_id: '',
    upi_payee_name: 'Soul Craft Studio',
    cod_enabled: true,
    cod_fee: 0,
  },
  notifications: {
    welcome: true,
    order_confirmation: true,
    order_status: true,
    payment_status: true,
    admin_new_order: true,
    admin_payment_received: true,
    admin_contact_message: true,
    admin_recipients: [],
  },
  reviews: {
    auto_approve: false,
  },
  inventory: {
    low_stock_threshold: 3,
  },
};

function mergeDeep(defaults, stored) {
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const defVal = defaults[key];
    const storedVal = stored?.[key];
    if (storedVal === undefined || storedVal === null) continue;
    if (defVal && typeof defVal === 'object' && !Array.isArray(defVal)) {
      result[key] = mergeDeep(defVal, storedVal);
    } else {
      result[key] = storedVal;
    }
  }
  return result;
}

const loadSettingsCached = unstable_cache(
  async () => {
    const db = await getDb();
    const doc = await db.collection('settings').findOne({ _id: SETTINGS_ID });
    const { _id, updated_at, updated_by, ...stored } = doc || {};
    return mergeDeep(DEFAULT_SETTINGS, stored);
  },
  ['store-settings'],
  { tags: ['settings'], revalidate: 300 }
);

export async function getSettings() {
  return loadSettingsCached();
}

/** Everything the storefront needs — never includes secrets. */
export async function getPublicSettings() {
  const s = await getSettings();
  const upiReady = s.payments.upi_enabled && !!s.payments.upi_id;
  return {
    store: s.store,
    home: s.home,
    shipping: s.shipping,
    payments: {
      upi: upiReady,
      upi_id: upiReady ? s.payments.upi_id : null,
      upi_payee_name: s.payments.upi_payee_name,
      cod: !!s.payments.cod_enabled,
      cod_fee: Number(s.payments.cod_fee || 0),
    },
  };
}

export async function saveSettingsSection(section, values, user) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, section)) {
    throw new Error(`Unknown settings section: ${section}`);
  }
  const db = await getDb();
  await db.collection('settings').updateOne(
    { _id: SETTINGS_ID },
    { $set: { [section]: values, updated_at: new Date().toISOString(), updated_by: user?.email || null } },
    { upsert: true }
  );
}

/** Shipping + COD fee for a given subtotal, using current settings. */
export function computeCharges(settings, subtotal, paymentMethod) {
  const { flat_fee, free_shipping_threshold } = settings.shipping;
  const threshold = Number(free_shipping_threshold || 0);
  const shippingFee = threshold > 0 && subtotal >= threshold ? 0 : Math.max(0, Math.round(Number(flat_fee || 0)));
  const codFee = paymentMethod === 'COD' ? Math.max(0, Math.round(Number(settings.payments.cod_fee || 0))) : 0;
  return { shippingFee, codFee, total: subtotal + shippingFee + codFee };
}
