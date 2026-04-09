"use client";

import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, Truck, ShieldCheck, CreditCard } from 'lucide-react';
import Link from 'next/link';

const CheckoutPage = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('shipping'); // 'shipping' or 'payment'

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    state: ''
  });

  const [paymentData, setPaymentData] = useState({
    paymentId: '',
    screenshot: null
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({ ...prev, [name]: value }));
  };

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    setStep('payment');
    window.scrollTo(0, 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Create order object
    const newOrder = {
      id: `SC-${Math.floor(Math.random() * 1000000)}`,
      date: new Date().toLocaleString(),
      items: cart,
      total: cartTotal,
      status: 'Confirmed',
      paymentStatus: 'Pending Verification',
      paymentId: paymentData.paymentId,
      shipping: formData
    };

    // Save to localStorage
    const existingOrders = JSON.parse(localStorage.getItem('soulcraft_orders') || '[]');
    localStorage.setItem('soulcraft_orders', JSON.stringify([newOrder, ...existingOrders]));
    
    // Clear cart
    clearCart();
    
    // Simulate order processing
    setTimeout(() => {
      router.push(`/order-success?id=${newOrder.id}`);
    }, 1500);
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center gap-6">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm">
            <ChevronLeft className="w-10 h-10 text-slate-300" />
          </div>
          <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Your cart is empty</h1>
          <p className="text-slate-500 max-w-sm">Please add some handcrafted items to your cart before checking out.</p>
          <Link href="/shop" className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
            Browse Shop
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-8">
          <button 
            onClick={() => step === 'payment' ? setStep('shipping') : router.push('/shop')}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500 w-fit transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 'payment' ? 'Back to Shipping' : 'Back to Shop'}
          </button>

          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
            {step === 'shipping' ? 'Checkout.' : 'Payment.'}
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mt-4">
            {/* Form Column */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              {step === 'shipping' ? (
                <form onSubmit={handleProceedToPayment} className="flex flex-col gap-8">
                  {/* Shipping Section */}
                  <div className="bg-white rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-blue-950">Shipping Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Full Name</label>
                        <input 
                          required
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          placeholder="Khushi Patel"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Email Address</label>
                        <input 
                          required
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="khushi@example.com"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Complete Address</label>
                        <textarea 
                          required
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="Street, Landmark, Apartment NO."
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">City</label>
                        <input 
                          required
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="Surat"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Pincode</label>
                        <input 
                          required
                          name="pincode"
                          value={formData.pincode}
                          onChange={handleInputChange}
                          placeholder="395001"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-blue-600 text-white py-6 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    Proceed to Payment
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                  {/* Payment Section */}
                  <div className="bg-white rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-blue-950">Scan & Pay</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                      {/* QR Code Column */}
                      <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                        <div className="w-full aspect-square bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
                          <img 
                            src="/images/qr-dummy.png" 
                            alt="Payment QR Code" 
                            className="w-full h-full object-cover p-2"
                          />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-950/60 text-center">
                          Scan with any UPI App (GPay, PhonePe, Paytm)
                        </p>
                      </div>

                      {/* Input Column */}
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Payment / Transaction ID</label>
                          <input 
                            required
                            name="paymentId"
                            value={paymentData.paymentId}
                            onChange={handlePaymentChange}
                            placeholder="Ex: 123456789012"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Upload Screenshot (Optional)</label>
                          <div className="relative group cursor-pointer">
                            <input 
                              type="file" 
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl px-5 py-8 text-center transition-all group-hover:border-blue-400 group-hover:bg-blue-50/30">
                              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-blue-500" />
                              <span className="text-xs font-bold text-slate-400 group-hover:text-blue-600 uppercase tracking-widest">Select Image</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
                      <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest leading-loose">
                        Please pay the exact amount: ₹{cartTotal}. Your order will be confirmed after payment verification.
                      </p>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-6 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Confirm Payment & Order
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Order Summary Column */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm sticky top-32">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-950 mb-8 pb-4 border-b border-slate-50">Order Summary</h3>
                
                <div className="flex flex-col gap-6 max-h-[300px] overflow-y-auto pr-2 mb-8 scrollbar-hide">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                        <p className="text-xs font-black uppercase text-blue-950 line-clamp-1">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} x ₹{item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4 pt-6 border-t border-slate-50">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Subtotal</span>
                    <span className="font-bold text-blue-950">₹{cartTotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Shipping</span>
                    <span className="font-bold text-green-500 uppercase tracking-widest text-[10px]">Free</span>
                  </div>
                  <div className="flex justify-between text-base pt-4 border-t border-slate-50 mt-2">
                    <span className="text-blue-950 font-black uppercase tracking-tight">Total Amount</span>
                    <span className="font-black text-blue-600">₹{cartTotal}</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-4 bg-orange-50/50 p-6 rounded-2xl border border-orange-100">
                  <div className="flex gap-3 items-center">
                    <ShieldCheck className="w-5 h-5 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-900 leading-tight">Secure Transaction Guaranteed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CheckoutPage;
