"use client";

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';


export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push(redirectPath);
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        console.log('Google login code received:', tokenResponse.code);
        const result = await loginWithGoogle(tokenResponse.code);
        if (result.success) {
          router.push(redirectPath);
        } else {
          setError(result.error || 'Google login failed');
        }
      } catch (err) {
        setError(err.message || 'Google login failed');
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google Login Failed:', error);
      setError('Google Login Failed');
    },
    flow: 'auth-code',
  });


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-orange-200">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 relative overflow-hidden">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-8">
              <div className="text-center flex flex-col gap-3">
                <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
                  Welcome <span className="text-blue-600">Back.</span>
                </h1>
                <p className="text-slate-500 text-sm font-medium">
                  Login to your account to manage your orders.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-300">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hello@example.com"
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 hover:shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                >
                  {loading ? 'Logging in...' : (
                    <>
                      <span>Sign In Now</span>
                      <LogIn className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex flex-col gap-6 items-center">
                <div className="w-full flex items-center gap-4">
                  <div className="h-px bg-slate-100 flex-grow" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">or continue with</span>
                  <div className="h-px bg-slate-100 flex-grow" />
                </div>

                {/* Google UI Mock */}
                <button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={loading}
                  className="w-full bg-white border border-slate-200 text-slate-600 rounded-2xl py-4 font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5 grayscale" alt="Google" />
                  <span>{loading ? 'Processing...' : 'Google Account'}</span>
                </button>


                <p className="text-sm text-slate-500 font-medium">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="text-orange-500 font-bold hover:underline">Register here</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
