import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import TrustStrip from '../components/TrustStrip';
import ProductShowcase from '../components/ProductShowcase';
import BrandVideos from '../components/BrandVideos';
import Categories from '../components/Categories';
import ProductCard from '../components/ProductCard';
import Testimonials from '../components/Testimonials';
import Founder from '../components/Founder';
import Footer from '../components/Footer';
import { getPublicSettings, DEFAULT_SETTINGS } from '../lib/server/settings';
import { getFeaturedProducts, queryProducts, listCategoriesCached, listPublicTestimonialsCached } from '../lib/server/catalog';
import { normalizeProduct } from '../lib/normalize';

// Rendered per request from cached data (admin edits show up immediately).
export const dynamic = 'force-dynamic';

async function safe(promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    console.error('Home data load failed:', err);
    return fallback;
  }
}

export default async function Home() {
  const [settings, featuredRaw, latest, categories, testimonials] = await Promise.all([
    safe(getPublicSettings(), { home: DEFAULT_SETTINGS.home, shipping: DEFAULT_SETTINGS.shipping }),
    safe(getFeaturedProducts(), []),
    safe(queryProducts({ page_size: 8 }), { results: [] }),
    safe(listCategoriesCached(), []),
    safe(listPublicTestimonialsCached(), []),
  ]);

  const home = settings.home || {};
  const latestProducts = latest.results.map(normalizeProduct);

  // Until the owner picks featured products, spotlight the newest in-stock pieces.
  const featured = (featuredRaw.length ? featuredRaw : latest.results.filter((p) => p.stock > 0).slice(0, 3)).map(normalizeProduct);
  const featuredIds = new Set(featured.map((p) => p.id));
  const newArrivals = latestProducts.filter((p) => !featuredIds.has(p.id)).slice(0, 8);
  const collage = featured.map((p) => p.image).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />
      <Hero home={home} collage={collage} reviewCount={testimonials.length} />
      <TrustStrip shipping={settings.shipping} />

      {featured.length > 0 && (
        <div id="featured" className="scroll-mt-20">
          {featured.map((product, i) => (
            <ProductShowcase key={product.id} product={product} index={i} />
          ))}
        </div>
      )}

      <BrandVideos title={home.story_title} subtitle={home.story_subtitle} videos={home.brand_videos || []} />

      {home.show_categories !== false && <Categories categories={categories} />}

      {home.show_new_arrivals !== false && newArrivals.length > 0 && (
        <section className="w-full max-w-7xl mx-auto px-4 md:px-8 pb-16 md:pb-24 flex flex-col gap-10">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">Fresh off the needles</span>
              <h2 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
                New <span className="text-blue-600">Arrivals.</span>
              </h2>
            </div>
            <Link href="/shop" className="hidden sm:inline-flex text-sm font-black uppercase tracking-widest text-blue-600 hover:text-orange-500">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-8">
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <Link
            href="/shop"
            className="self-center px-10 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-sm rounded-full hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
          >
            Explore all products
          </Link>
        </section>
      )}

      <Testimonials testimonials={testimonials} products={latestProducts.concat(featured)} />

      <main className="w-full max-w-6xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
        <Founder />
      </main>

      <Footer />
    </div>
  );
}
