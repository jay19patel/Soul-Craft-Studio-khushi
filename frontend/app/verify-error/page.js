"use client";

import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function VerifyErrorPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  let title = "Verification Failed";
  let message = "This verification link is invalid or has already been used. Please try registering again or contact support.";

  if (reason === 'invalid_token') {
    title = "Link Expired";
    message = "Your verification link has expired or is invalid. For security reasons, these links only last for 24 hours.";
  } else if (reason === 'server_error') {
    title = "System Error";
    message = "We encountered a technical issue while verifying your email. Please try again in a few minutes.";
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-20 text-center">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 relative overflow-hidden">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-8">
              <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center ring-8 ring-red-100/50">
                   <AlertCircle className="w-10 h-10 text-red-500" />
              </div>

              <div className="flex flex-col gap-3">
                <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950 leading-tight">
                  Oops! <span className="text-red-600">{title}</span>
                </h1>
                <p className="text-slate-500 text-sm font-medium">
                  {message}
                </p>
              </div>

              <div className="flex flex-col w-full gap-4">
                <Link 
                  href="/register" 
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-100 hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Mail className="w-5 h-5" />
                  <span>Try Registering Again</span>
                </Link>

                <Link 
                  href="/" 
                  className="w-full bg-white border border-slate-200 text-slate-600 rounded-2xl py-4 font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back to Home</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
