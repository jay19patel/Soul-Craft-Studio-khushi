import React from 'react';
import Image from 'next/image';
import siteData from '../data/siteData.json';

const Products = () => {
    const { products } = siteData;

    return (
        <section id="products" className="w-full flex flex-col gap-12 py-12">
            <div className="text-center flex flex-col gap-4">
                <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">Our Creations</span>
                <h2 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
                    Featured <span className="text-blue-600">Products.</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {products.map((prod, idx) => (
                    <div key={idx} className="flex flex-col gap-6 group">
                        <div className="aspect-square relative rounded-[32px] overflow-hidden bg-white border border-slate-100 group-hover:shadow-xl transition-all duration-500">
                            <Image
                                src={prod.img}
                                alt={prod.name}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute top-6 left-6 px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-blue-950 shadow-sm border border-slate-100">
                                {prod.tag}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 px-2">
                            <h3 className="text-lg font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight group-hover:text-orange-500 transition-colors">
                                {prod.name}
                            </h3>
                            <p className="text-lg font-black text-slate-400 font-sans">{prod.price}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-center mt-8">
                <button className="px-10 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-sm rounded-full hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 hover:shadow-blue-200 active:scale-95 group flex items-center gap-3">
                    Explore All Products
                    <svg className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
                    </svg>
                </button>
            </div>
        </section>
    );
};

export default Products;
