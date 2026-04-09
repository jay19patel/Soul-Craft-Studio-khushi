import React from 'react';
import Image from 'next/image';
import siteData from '../data/siteData.json';

const Categories = () => {
    const { categories } = siteData;

    return (
        <section id="categories" className="w-full flex flex-col gap-12 py-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex flex-col gap-4">
                    <span className="text-blue-600 font-extrabold tracking-widest uppercase text-sm">Browse Crafts</span>
                    <h2 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                        Explore <br /> <span className="text-orange-500">Categories.</span>
                    </h2>
                </div>
                <p className="text-slate-500 max-w-sm font-medium">Discover the magic of handmade wool art across our diverse collections.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {categories.map((cat, idx) => (
                    <div key={idx} className={`group relative rounded-[40px] overflow-hidden ${cat.color} border border-slate-100 hover:shadow-2xl hover:shadow-slate-200 transition-all duration-500 cursor-pointer`}>
                        <div className="aspect-[4/5] relative overflow-hidden">
                            <Image
                                src={cat.img}
                                alt={cat.name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                            <h3 className="text-2xl font-[family-name:var(--font-climate-crisis)] uppercase text-white drop-shadow-md">{cat.name}</h3>
                            <p className="text-white/80 font-bold mt-1 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">{cat.count}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Categories;
