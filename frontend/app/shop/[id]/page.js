import React from 'react';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProductDetail from './ProductDetail';
import { getActiveProduct, queryProducts, listPublicTestimonialsCached } from '../../../lib/server/catalog';
import { getPublicSettings } from '../../../lib/server/settings';
import { normalizeProduct } from '../../../lib/normalize';

export const dynamic = 'force-dynamic';

async function loadProduct(id) {
  try {
    return await getActiveProduct(decodeURIComponent(id));
  } catch (err) {
    console.error('Product load failed:', err);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) return { title: 'Product not found' };
  const description = product.tagline || product.description?.slice(0, 160) || undefined;
  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.primary_image ? [{ url: product.primary_image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const raw = await loadProduct(id);

  if (!raw) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center gap-6 text-center px-4 py-24">
          <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Product not found</h1>
          <p className="text-slate-500 max-w-sm">This piece is no longer available. Explore the rest of the collection!</p>
          <Link href="/shop" className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm">
            Back to shop
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const [related, testimonials, settings] = await Promise.all([
    queryProducts({ category_id: raw.category_id || undefined, exclude_id: raw.id, page_size: 4 }).catch(() => ({ results: [] })),
    listPublicTestimonialsCached().catch(() => []),
    getPublicSettings().catch(() => null),
  ]);

  const product = normalizeProduct(raw);
  const reviews = testimonials.filter((t) => t.product_id === product.id);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline || product.description,
    image: product.images,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.salePrice,
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ProductDetail
        product={product}
        related={related.results.map(normalizeProduct)}
        reviews={reviews}
        shipping={settings?.shipping || {}}
      />
      <Footer />
    </div>
  );
}
