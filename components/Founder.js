import React from 'react';
import Image from 'next/image';
import siteData from '../data/siteData.json';

const Founder = () => {
    const { founder, brand } = siteData;

    return (
        <section id="founder" className="w-full py-16 md:py-24 border-t border-orange-100 bg-orange-50/30 rounded-[60px] my-12 overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
                {/* Left Side: Founder Image */}
                <div className="relative group">
                    <div className="aspect-[4/5] relative rounded-[40px] overflow-hidden shadow-2xl shadow-orange-200/50 border-4 border-white group-hover:scale-[1.02] transition-transform duration-500">
                        <Image
                            src={founder.image}
                            alt={founder.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover"
                        />
                        {/* Artistic overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent"></div>
                    </div>

                </div>

                {/* Right Side: Founder Info */}
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-4">
                        <span className="text-orange-600 font-extrabold tracking-widest uppercase text-sm">Meet the Artist</span>
                        <h2 className="text-5xl md:text-6xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                            {founder.name.split(' ')[0]} <br /> <span className="text-blue-600">{founder.name.split(' ')[1]}.</span>
                        </h2>
                        <p className="text-xl text-slate-700 font-bold leading-relaxed italic">
                            "{founder.quote}"
                        </p>
                    </div>



                    <div className="flex flex-col gap-4 mt-4 bg-white/50 backdrop-blur-sm p-6 rounded-3xl border border-orange-100">
                        <h4 className="text-blue-950 font-black uppercase text-xs tracking-widest">Connect with me</h4>
                        <div className="flex flex-col gap-3">
                            <a href={`mailto:${brand.email}`} className="flex items-center gap-3 text-slate-600 hover:text-orange-500 font-bold transition-colors">
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
                                </div>
                                {brand.email}
                            </a>
                            {brand.phone && (
                                <a href={`tel:${brand.phone.replace(/\s+/g, '')}`} className="flex items-center gap-3 text-slate-600 hover:text-orange-500 font-bold transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                                    </div>
                                    {brand.phone}
                                </a>
                            )}
                            {brand.instagram && (
                                <a href={brand.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-600 hover:text-orange-500 font-bold transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-pink-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.344 3.608 1.319.975.975 1.257 2.242 1.319 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.344 2.633-1.319 3.608-.975.975-2.242 1.257-3.608 1.319-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.344-3.608-1.319-.975-.975-1.257-2.242-1.319-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.344-2.633 1.319-3.608.975-.975 2.242-1.257 3.608-1.319 1.266-.058 1.646-.07 4.85-.07m0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.28-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.28.059 1.689.073 4.948.073s3.667-.014 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948s-.014-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98-1.28-.059-1.689-.073-4.948-.073zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.169a1.44 1.44 0 100-2.881 1.44 1.44 0 000 2.881z" /></svg>
                                    </div>
                                    @craftyyy111
                                </a>
                            )}
                            <div className="flex items-center gap-3 text-slate-600 font-bold">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                                </div>
                                {brand.location}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Founder;
