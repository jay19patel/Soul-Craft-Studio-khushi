/**
 * Catalog reads (products, categories, testimonials) shared by server actions
 * and server-rendered pages. Public reads are cached and tagged so admin edits
 * invalidate them immediately (see invalidate() in core.js).
 */
import { unstable_cache } from 'next/cache';
import { getDb } from '../db';
import { getQueryById, escapeRegExp } from './core';

export const effectivePrice = (basePrice, discount) =>
  Math.round(Number(basePrice || 0) * (1 - Number(discount || 0) / 100));

export function primaryImageOf(p) {
  const img = (p.images || []).find((i) => i.is_primary) || (p.images || [])[0] || null;
  return img ? img.image_url : null;
}

export function totalStockOf(p) {
  return (p.variants || []).reduce((sum, v) => sum + Math.max(0, Number(v.stock || 0)), 0);
}

export function serializeCategory(c) {
  return {
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description || '',
    image_url: c.image_url || null,
    sort_order: Number(c.sort_order || 0),
    created_at: c.created_at || null,
  };
}

export function serializeProduct(p, categoryMap = {}) {
  const cat = categoryMap[String(p.category_id)] || null;
  const primary_image = primaryImageOf(p);
  const basePrice = Number(p.base_price || 0);
  const discount = Number(p.discount || 0);
  return {
    id: p._id.toString(),
    name: p.name,
    slug: p.slug,
    tagline: p.tagline || '',
    description: p.description || '',
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    base_price: String(basePrice),
    price_value: basePrice,
    discount,
    sale_price: effectivePrice(basePrice, discount),
    is_active: !!p.is_active,
    is_featured: !!p.is_featured,
    featured_order: Number(p.featured_order || 0),
    created_at: p.created_at || null,
    updated_at: p.updated_at || null,
    stock: totalStockOf(p),
    category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
    category_id: p.category_id ? String(p.category_id) : null,
    primary_image,
    image_url: primary_image,
    gallery_images: (p.images || []).map((img) => img.image_url),
    images: (p.images || []).map((img) => ({
      id: String(img.id),
      image_url: img.image_url,
      is_primary: !!img.is_primary,
    })),
    variants: (p.variants || []).map((v) => ({
      id: String(v.id),
      sku: v.sku || '',
      size: v.size || '',
      color: v.color || '',
      price_override: v.price_override ? String(v.price_override) : null,
      stock: Number(v.stock || 0),
    })),
    videos: Array.isArray(p.videos) ? p.videos : [],
  };
}

export async function getCategoryMap(db) {
  const categories = await db.collection('categories').find().toArray();
  const map = {};
  for (const c of categories) map[c._id.toString()] = serializeCategory(c);
  return map;
}

// ── Categories ──

export const listCategoriesCached = unstable_cache(
  async () => {
    const db = await getDb();
    const categories = await db.collection('categories').find().sort({ sort_order: 1, name: 1 }).toArray();
    return categories.map(serializeCategory);
  },
  ['categories-list-v2'],
  { tags: ['categories'], revalidate: 300 }
);

// ── Products ──

const listActiveProductsCached = unstable_cache(
  async () => {
    const db = await getDb();
    const [products, categoryMap] = await Promise.all([
      db.collection('products').find({ is_active: true }).sort({ created_at: -1 }).toArray(),
      getCategoryMap(db),
    ]);
    return products.map((p) => serializeProduct(p, categoryMap));
  },
  ['products-active-v2'],
  { tags: ['products', 'categories'], revalidate: 120 }
);

export async function queryProducts(params = {}) {
  let products = await listActiveProductsCached();

  const targetCategory = params.category_id || params.category;
  if (targetCategory && targetCategory !== 'all') {
    const key = String(targetCategory);
    products = products.filter((p) => p.category_id === key || p.category?.slug === key);
  }

  if (params.search) {
    const re = new RegExp(escapeRegExp(String(params.search).slice(0, 100)), 'i');
    products = products.filter((p) => re.test(p.name) || re.test(p.description) || re.test(p.tagline));
  }

  if (params.discount_only) products = products.filter((p) => p.discount > 0);
  if (params.in_stock_only) products = products.filter((p) => p.stock > 0);
  if (params.exclude_id) products = products.filter((p) => p.id !== String(params.exclude_id));

  if (params.sort_by === 'price_asc') {
    products = [...products].sort((a, b) => a.sale_price - b.sale_price);
  } else if (params.sort_by === 'price_desc') {
    products = [...products].sort((a, b) => b.sale_price - a.sale_price);
  }

  // Sold-out pieces stay visible (handmade buyers like to see what's coming
  // back) but sink below the ones that can be bought right now.
  products = [...products].sort((a, b) => (b.stock > 0) - (a.stock > 0));

  const total = products.length;
  if (params.page_size) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(params.page_size)));
    products = products.slice((page - 1) * pageSize, page * pageSize);
  }
  return { results: products, total };
}

export async function getFeaturedProducts() {
  const products = await listActiveProductsCached();
  return products
    .filter((p) => p.is_featured)
    .sort((a, b) => a.featured_order - b.featured_order || String(b.created_at).localeCompare(String(a.created_at)));
}

/** Public product lookup — disabled products behave as "not found". */
export async function getActiveProduct(id) {
  const products = await listActiveProductsCached();
  return products.find((p) => p.id === String(id) || p.slug === String(id)) || null;
}

/** Admin lookup — includes disabled products. */
export async function getAnyProduct(id) {
  const db = await getDb();
  const p = await db.collection('products').findOne(getQueryById(id));
  if (!p) return null;
  return serializeProduct(p, await getCategoryMap(db));
}

// ── Testimonials ──

export function serializeTestimonial(t) {
  return {
    id: t._id.toString(),
    author_name: t.author_name || 'Customer',
    author_location: t.author_location || '',
    content: t.content || '',
    rating: Math.min(5, Math.max(1, Number(t.rating || 5))),
    video_url: t.video_url || '',
    youtube_id: t.youtube_id || null,
    is_short: !!t.is_short,
    product_id: t.product_id || null,
    avatar_url: t.avatar_url || null,
    is_active: !!t.is_active,
    is_featured: !!t.is_featured,
    source: t.source || (t.user_id ? 'customer' : 'admin'),
    user_id: t.user_id || null,
    created_at: t.created_at || null,
    updated_at: t.updated_at || null,
  };
}

export const listPublicTestimonialsCached = unstable_cache(
  async () => {
    const db = await getDb();
    const rows = await db
      .collection('testimonials')
      .find({ is_active: true })
      .sort({ is_featured: -1, created_at: -1 })
      .limit(60)
      .toArray();
    return rows.map(serializeTestimonial);
  },
  ['testimonials-public-v2'],
  { tags: ['testimonials'], revalidate: 300 }
);
