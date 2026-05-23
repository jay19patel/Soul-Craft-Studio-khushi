import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Categories from '../components/Categories';
import Products from '../components/Products';
import Testimonials from '../components/Testimonials';
import Founder from '../components/Founder';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />
      <Hero />

      <main className="flex-grow w-full max-w-6xl mx-auto px-4 pt-8 md:pt-12 pb-16 flex flex-col items-center gap-24 md:gap-32">
        <Features />
        <Categories />
        <Products />
      </main>

      <Testimonials />

      <main className="flex-grow w-full max-w-6xl mx-auto px-4 py-16 md:py-24 flex flex-col items-center">
        <Founder />
      </main>

      <Footer />
    </div>
  );
}
