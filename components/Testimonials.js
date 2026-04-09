'use client';
import React from 'react';
import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonialsData = [
  {
    id: 1,
    name: "Aarti Sharma",
    image: "https://i.pravatar.cc/150?img=41",
    feedback: "The handcrafted woolen scarf I received is simply beautiful. The quality of the wool is incredibly soft, and you can really feel the love knitted into it!",
    productImage: "https://images.unsplash.com/photo-1605282722370-dcc2525aa1cc?auto=format&fit=crop&q=80&w=300", 
  },
  {
    id: 2,
    name: "Rohan Patel",
    image: "https://i.pravatar.cc/150?img=11",
    feedback: "I ordered a custom keychain for my wife, and she absolutely loved it. The attention to detail is stunning and it arrived perfectly packaged.",
    productImage: "https://images.unsplash.com/photo-1620791493630-f9fdc61df1cd?auto=format&fit=crop&q=80&w=300", 
  },
  {
    id: 3,
    name: "Sneha Desai",
    image: "https://i.pravatar.cc/150?img=43",
    feedback: "The woolen decor pieces completely changed the vibe of my living room! Khushi is truly an amazing artist. Will definitely buy again.",
    productImage: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=300", 
  },
  {
    id: 4,
    name: "Vikram Singh",
    image: "https://i.pravatar.cc/150?img=12",
    feedback: "Bought the Cloud Plush as a gift for my daughter. It's incredibly warm, sustainable, and looks so incredibly cute. 10/10 recommend!",
    productImage: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&q=80&w=300", 
  },
  {
    id: 5,
    name: "Meera Reddy",
    image: "https://i.pravatar.cc/150?img=44",
    feedback: "Absolutely gorgeous work! The woolen tote is not only fashionable but also incredibly durable. It stands out wherever I go.",
    productImage: "https://images.unsplash.com/photo-1510419356345-d36d859fa21e?auto=format&fit=crop&q=80&w=300", 
  }
];

// Double array to create seamless loop
const duplicatedTestimonials = [...testimonialsData, ...testimonialsData];

const Testimonials = () => {
    return (
        <section id="testimonials" className="w-full py-20 overflow-hidden bg-slate-50 relative scroll-mt-20">
            {/* Background elements */}
            <div className="absolute top-0 right-[-10%] w-[30vw] h-[30vw] bg-orange-200/40 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-[-10%] w-[30vw] h-[30vw] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-16 text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 font-bold text-sm mb-6"
                >
                    <Star className="w-4 h-4 fill-orange-500" />
                    <span>Customer Stories</span>
                </motion.div>
                <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl md:text-5xl font-extrabold text-blue-950 tracking-tight"
                >
                    Loved by our <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">Community</span>
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-600 mt-4 max-w-2xl mx-auto text-lg"
                >
                    Real feedback from people who have experienced the warmth and quality of our handcrafted woolen art.
                </motion.p>
            </div>

            {/* Scrolling Carousel */}
            <div className="relative w-full flex overflow-hidden group py-4">
                {/* Marquee Track */}
                <div 
                    className="flex shrink-0 animate-marquee hover:[animation-play-state:paused]"
                    style={{ width: 'fit-content' }}
                >
                    {duplicatedTestimonials.map((testimonial, idx) => (
                        <div 
                            key={`${testimonial.id}-${idx}`} 
                            className="w-[320px] md:w-[400px] shrink-0 px-4"
                        >
                            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 h-full flex flex-col gap-6 relative group transition-transform duration-300 hover:-translate-y-2">
                                {/* Decorative Quote */}
                                <Quote className="absolute top-6 right-6 w-12 h-12 text-slate-100 -z-0 rotate-12 group-hover:text-orange-50 transition-colors duration-300" />
                                
                                {/* Product Image Highlight */}
                                <div className="w-full h-40 rounded-2xl overflow-hidden relative z-10">
                                    <img 
                                        src={testimonial.productImage} 
                                        alt="Product" 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                </div>

                                {/* Review Content */}
                                <div className="relative z-10 flex-grow flex flex-col gap-4">
                                    <div className="flex gap-1">
                                        {[1,2,3,4,5].map(star => (
                                            <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                        ))}
                                    </div>
                                    <p className="text-slate-600 italic leading-relaxed text-sm md:text-base">
                                        "{testimonial.feedback}"
                                    </p>
                                </div>

                                {/* Customer details */}
                                <div className="flex items-center gap-4 pt-4 border-t border-slate-100 relative z-10">
                                    <img src={testimonial.image} alt={testimonial.name} className="w-12 h-12 rounded-full border-2 border-orange-200 shadow-sm object-cover" />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-blue-950 text-sm">{testimonial.name}</span>
                                        <span className="text-xs text-slate-500 font-medium">Verified Customer</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
