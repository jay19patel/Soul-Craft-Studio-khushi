"use client";

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function VerifySuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-20 text-center">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 relative overflow-hidden">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-8">
              <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center ring-8 ring-green-100/50">
                   <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>

              <div className="flex flex-col gap-3">
                <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                  Email <span className="text-green-600">Verified!</span>
                </h1>
                <p className="text-slate-500 text-sm font-medium">
                  Your registration is now complete. You can sign in to manage your soulful orders and profile.
                </p>
              </div>

              <Link 
                href="/login" 
                className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 hover:shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <span>Continue to Login</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
