import React from 'react';

const Features = () => {
    return (
        <section className="w-full grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 md:gap-6 auto-rows-[250px] md:auto-rows-[300px]">
            {/* Card 1: Large Feature */}
            <div className="md:col-span-2 rounded-3xl bg-blue-50 border border-blue-100 p-8 flex flex-col justify-between group hover:shadow-xl hover:shadow-blue-100 transition-all duration-300 relative overflow-hidden">
                <div className="z-10 relative">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-widest rounded-lg mb-4">100% Handmade</span>
                    <h3 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-900 mb-4 mt-2">Pure Wool<br />Perfection</h3>
                    <p className="text-blue-700/80 max-w-md font-medium text-lg leading-relaxed">
                        Every piece is uniquely handcrafted by skilled artisans using the finest sustainably sourced wool and materials.
                    </p>
                </div>
                <div className="absolute -bottom-16 -right-16 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl group-hover:bg-blue-300/50 transition-colors duration-500"></div>
                <svg className="absolute bottom-8 right-8 w-32 h-32 text-blue-600/10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
            </div>

            {/* Card 2: Square Category */}
            <div className="rounded-3xl bg-orange-50 border border-orange-100 p-8 flex flex-col justify-between items-center text-center group hover:-translate-y-2 hover:shadow-xl hover:shadow-orange-100 transition-all duration-300">
                <div className="w-20 h-20 rounded-2xl bg-orange-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-orange-200 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                    </svg>
                </div>
                <div>
                    <h3 className="text-xl font-[family-name:var(--font-climate-crisis)] uppercase text-orange-950">Artisan<br />Keychains</h3>
                    <p className="text-orange-700 font-medium mt-2">Small gifts, big smiles</p>
                </div>
            </div>

            {/* Card 3: Square Feature */}
            <div className="rounded-3xl bg-white border border-slate-200 p-8 flex flex-col justify-between group hover:border-blue-300 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 rounded-bl-[100px] -z-0 group-hover:bg-blue-100 transition-colors duration-500"></div>
                <div className="z-10 bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 mb-6 shadow-sm">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div className="z-10">
                    <h3 className="text-xl font-[family-name:var(--font-climate-crisis)] uppercase text-slate-900">Custom<br />Orders</h3>
                    <p className="text-slate-500 font-medium mt-2">Made just for you</p>
                </div>
            </div>

            {/* Card 4: Horizontal Span */}
            <div className="md:col-span-2 rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 p-8 flex flex-col md:flex-row items-center justify-between text-white relative overflow-hidden group hover:shadow-2xl hover:shadow-blue-200 transition-all duration-300">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-800/20 rounded-full blur-2xl"></div>

                <div className="relative z-10 max-w-md text-center md:text-left">
                    <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold tracking-widest uppercase rounded-lg mb-4">Festive Edition</span>
                    <h3 className="text-3xl md:text-4xl font-[family-name:var(--font-climate-crisis)] uppercase mb-4 leading-tight tracking-wide">Holiday Decor</h3>
                    <p className="text-blue-50 text-lg font-medium opacity-90">Get ready for the season with our handcrafted wool ornaments and festive decorations.</p>
                </div>

                <div className="relative z-10 mt-8 md:mt-0 w-full md:w-auto">
                    <button className="w-full md:w-auto px-8 py-4 bg-orange-500 text-white font-extrabold rounded-full shadow-xl hover:shadow-orange-400 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                        View Collection
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Features;
