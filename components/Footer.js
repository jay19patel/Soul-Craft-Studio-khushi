import React from 'react';
import siteData from '../data/siteData.json';

const Footer = () => {
    const { faqs, brand } = siteData;

    return (
        <footer id="footer" className="w-full py-12 border-t border-slate-200 mt-auto bg-white">
            <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-start justify-between gap-12">
                {/* Brand Section */}
                <div className="flex flex-col gap-6 max-w-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shadow-orange-100">
                            <img src="/logo.png" alt="SCS Logo" className="w-full h-full object-cover scale-110" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-[family-name:var(--font-climate-crisis)] uppercase text-xs text-blue-950 tracking-wider">
                                Soul Craft
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-500">
                                Studio
                            </span>
                        </div>
                    </div>
                    <p className="text-slate-400 font-medium text-sm leading-relaxed">
                        {brand.tagline.split('.')[0]}. Bringing warmth to your soul.
                    </p>
                </div>

                {/* Q&A Section */}
                <div className="flex-grow max-w-2xl">
                    <h4 className="font-black text-blue-950 uppercase text-xs tracking-widest mb-6">Common Questions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {faqs.map((faq, idx) => (
                            <div key={idx} className="flex flex-col gap-3">
                                <h5 className="font-bold text-slate-900 text-sm leading-tight text-orange-600">{faq.q}</h5>
                                <p className="text-slate-400 font-medium text-xs leading-relaxed">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 mt-20 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center md:text-left">
                        © {new Date().getFullYear()} {brand.name}. All rights reserved.
                    </p>
                    <p className="text-slate-400 font-medium text-[10px] uppercase tracking-[0.2em] text-center md:text-left">
                        Developed by <a href="https://njtechstudio.in" target="_blank" rel="noopener noreferrer" className="text-purple-800 font-black hover:text-orange-500 transition-colors">njtechstudio</a>
                    </p>
                </div>
                <div className="flex gap-8 text-xs font-black uppercase tracking-widest text-slate-300">
                    <a href="/terms" className="hover:text-blue-600 transition-colors">Policies</a>
                    {brand.instagram ? (
                        <a href={brand.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Instagram</a>
                    ) : (
                        <a href="#" className="hover:text-blue-600 transition-colors">Instagram</a>
                    )}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
