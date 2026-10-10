import React from 'react';
import Link from 'next/link';

const CARD_COLORS = ['bg-orange-50', 'bg-blue-50', 'bg-slate-50', 'bg-amber-50', 'bg-emerald-50'];

const Categories = ({ categories = [] }) => {
  if (!categories.length) return null;

  return (
    <section id="categories" className="w-full max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <span className="text-blue-600 font-extrabold tracking-widest uppercase text-sm">Browse Crafts</span>
          <h2 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
            Explore <span className="text-orange-500">Categories.</span>
          </h2>
        </div>
        <p className="text-slate-500 max-w-sm font-medium">Discover handmade wool art across our collections.</p>
      </div>

      <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {categories.map((cat, idx) => (
          <Link
            href={`/shop?category_id=${cat.id}`}
            key={cat.id}
            className={`group relative w-[72%] sm:w-[45%] md:w-auto shrink-0 snap-center rounded-[32px] md:rounded-[40px] overflow-hidden ${CARD_COLORS[idx % CARD_COLORS.length]} border border-slate-100 hover:shadow-2xl transition-all duration-500`}
          >
            <div className="aspect-[4/5] relative overflow-hidden">
              {cat.image_url ? (
                <img src={cat.image_url} alt={cat.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <h3 className="text-xl md:text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-white drop-shadow-md">{cat.name}</h3>
              {cat.description && <p className="text-white/85 font-semibold mt-1 text-sm line-clamp-2">{cat.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default Categories;
