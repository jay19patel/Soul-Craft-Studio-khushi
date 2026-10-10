/** Pure shape helpers shared by server-rendered pages and client code. */


export function normalizeCategory(c) {
  if (!c) return null;
  const imageUrl = c.image_url || c.img || null;
  return { ...c, id: String(c.id || c._id || ''), img: imageUrl, image: imageUrl, image_url: imageUrl };
}

export function normalizeProduct(p) {
  if (!p) return null;
  const gallery = Array.isArray(p.gallery_images) ? p.gallery_images.filter(Boolean) : [];
  const mainImage = p.primary_image || p.image_url || p.image || null;
  const priceValue = Number(p.price_value ?? p.priceValue ?? 0);
  const discount = Number(p.discount || 0);
  return {
    ...p,
    id: String(p.id || p._id || ''),
    image: mainImage,
    images: gallery.length ? gallery : mainImage ? [mainImage] : [],
    priceValue,
    salePrice: p.sale_price ?? (discount > 0 ? Math.round(priceValue * (1 - discount / 100)) : priceValue),
    priceDisplay: `₹${priceValue.toLocaleString('en-IN')}`,
    videos: Array.isArray(p.videos) ? p.videos : [],
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
  };
}

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null);

export function normalizeOrder(o) {
  if (!o) return null;
  return {
    ...o,
    id: String(o.id || o._id || ''),
    date: fmtDate(o.created_at) || '',
    payment_verified_date: fmtDate(o.payment_verified_at),
    confirmed_date: fmtDate(o.confirmed_at),
    processing_date: fmtDate(o.processing_at),
    shipped_date: fmtDate(o.shipped_at),
    delivered_date: fmtDate(o.delivered_at),
    cancelled_date: fmtDate(o.cancelled_at),
    screenshot_url: o.screenshot_id || null,
    items: o.items || [],
  };
}

