'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Heart, Star, ShoppingBag, ArrowRight, CheckCircle2 } from 'lucide-react';
import siteData from '../data/siteData.json';

const Hero = () => {
    const { brand, categories } = siteData;
    const nameParts = brand.name.split(' ');
    const lastName = nameParts.pop();
    const firstNames = nameParts.join(' ');

    const images = [
        categories[0].img, // Woolen Fashion
        categories[1].img, // Keychains
        categories[2].img, // Handmade Decor
    ];

    return (
        <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-slate-50 font-sans border-b border-orange-100 pt-20 md:pt-0">
            {/* Animated Background Gradients */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[70vw] md:w-[50vw] h-[70vw] md:h-[50vw] bg-orange-200/50 rounded-full blur-[80px] md:blur-[120px] mix-blend-multiply opacity-60 animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] md:w-[50vw] h-[70vw] md:h-[50vw] bg-blue-100/50 rounded-full blur-[80px] md:blur-[120px] mix-blend-multiply opacity-60" style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                
                {/* Subtle Grid Pattern Overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMikiLz48L3N2Zz4=')]"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
                className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12 lg:gap-16 py-12 lg:py-24"
            >
                {/* Left Content */}
                <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-orange-100/80 border border-orange-200 backdrop-blur-md mb-6 md:mb-8 shadow-sm"
                    >
                        <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500" />
                        <span className="text-orange-700 text-xs md:text-sm font-bold tracking-wide">100% Handcrafted Woolen Art</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-[1] tracking-tight mb-4 md:mb-6 drop-shadow-sm"
                    >
                        <span className="block">{firstNames}</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400 block mt-1 md:mt-2">
                            {lastName}
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-base sm:text-lg md:text-xl text-slate-600 max-w-xl font-medium leading-relaxed mb-8 md:mb-10"
                    >
                        {brand.tagline}
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto px-4 sm:px-0"
                    >
                        <Link href="/shop" className="group relative w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-3.5 md:px-8 md:py-4 rounded-full font-bold text-base md:text-lg shadow-[0_10px_30px_-10px_rgba(249,115,22,0.6)] hover:shadow-[0_10px_40px_-10px_rgba(249,115,22,0.8)] transition-all duration-300 hover:-translate-y-1 active:scale-95">
                            <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
                            <span>Shop Collections</span>
                        </Link>
                        <button 
                            onClick={() => document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' })}
                            className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 px-6 py-3 md:px-8 md:py-3.5 rounded-full font-bold text-base md:text-lg transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-sm"
                        >
                            <span>Our Story</span>
                            <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>

                    {/* Stats / Trust items */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 1 }}
                        className="mt-8 md:mt-12 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pt-6 sm:pt-8 border-t border-slate-200 w-full justify-center lg:justify-start"
                    >
                        <div className="flex -space-x-2 md:-space-x-3">
                            {[1,2,3,4].map((i) => (
                                <div key={i} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden z-10 shadow-sm relative">
                                    <img src={`https://i.pravatar.cc/100?img=${i+40}`} alt="Customer" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col items-center sm:items-start text-slate-600">
                            <div className="flex items-center gap-1 mb-0.5 md:mb-1">
                                {[1,2,3,4,5].map((star) => (
                                    <Star key={star} className="w-3 h-3 md:w-4 md:h-4 text-amber-500 fill-amber-500" />
                                ))}
                            </div>
                            <span className="text-xs md:text-sm font-medium"><strong>Loved by 500+</strong> happy customers</span>
                        </div>
                    </motion.div>
                </div>

                {/* Right Content - Abstract Image Grid */}
                <div className="hidden md:flex w-full lg:w-1/2 relative h-[380px] sm:h-[450px] lg:h-[600px] items-center justify-center mt-6 lg:mt-0 shrink-0">
                    {/* Main big image */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.2, type: "spring" }}
                        className="absolute z-10 w-[200px] sm:w-[240px] lg:w-[320px] h-[260px] sm:h-[320px] lg:h-[420px] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-300/60 border border-white"
                    >
                        <img src={images[0]} alt={categories[0].name} className="w-full h-full object-cover select-none" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
                        <div className="absolute bottom-3 md:bottom-5 left-3 md:left-5 right-3 md:right-5 text-white">
                            <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                <span className="p-1 md:p-1.5 bg-white/20 rounded-full backdrop-blur-md">
                                    <Heart className="w-3 h-3 md:w-4 md:h-4 text-orange-400 fill-orange-400" />
                                </span>
                                <span className="font-semibold tracking-wide text-xs md:text-sm drop-shadow-md">Knitted with Love</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Top small image */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="absolute z-20 top-[0%] right-[5%] sm:right-[15%] lg:top-[5%] lg:right-[5%] w-28 sm:w-32 lg:w-48 h-32 sm:h-40 lg:h-56 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl shadow-slate-300/50 border-[3px] md:border-[6px] border-white bg-slate-100"
                    >
                        <img src={images[1]} alt={categories[1].name} className="w-full h-full object-cover select-none" />
                    </motion.div>

                    {/* Bottom small image */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.7 }}
                        className="absolute z-20 bottom-[5%] left-[5%] sm:left-[15%] lg:bottom-[10%] lg:left-[5%] w-32 sm:w-36 lg:w-52 h-36 sm:h-40 lg:h-56 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl shadow-slate-300/50 border-[3px] md:border-[6px] border-white bg-slate-100"
                    >
                        <img src={images[2]} alt={categories[2].name} className="w-full h-full object-cover select-none" />
                        <div className="absolute inset-0 bg-orange-500/10 mix-blend-overlay"></div>
                    </motion.div>
                </div>
            </motion.div>
            
            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 md:gap-2 hidden md:flex"
            >
                <span className="text-slate-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold">Scroll</span>
                <div className="w-[2px] h-6 md:h-10 bg-gradient-to-b from-orange-400 to-transparent rounded-full"></div>
            </motion.div>
        </section>
    );
};

export default Hero;
