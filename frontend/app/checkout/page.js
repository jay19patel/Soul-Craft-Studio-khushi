"use client";

import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, CreditCard, ShieldCheck, Loader2, Image as ImageIcon, X } from 'lucide-react';
import Link from 'next/link';
import { createOrder, uploadScreenshot } from '../../lib/api';

const CheckoutPage = () => {
  const { cart, cartTotal, clearCart, cartId } = useCart();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [step, setStep] = useState('shipping'); // 'shipping' | 'payment'
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
  });
  const [paymentData, setPaymentData] = useState({
    paymentId: '',
  });
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Authentication guard
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/checkout');
    }
  }, [isAuthenticated, authLoading, router]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Verifying Session...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not authenticated prevent render
  if (!isAuthenticated) return null;


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setScreenshotPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    setStep('payment');
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Build order items from cart
      const orderItems = cart.map((item) => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.priceValue ?? item.price ?? 0,
        image: item.image || item.img || null,
      }));

      // Full shipping address string
      const shippingAddress = [
        formData.address,
        formData.city,
        formData.state,
        formData.pincode,
      ]
        .filter(Boolean)
        .join(', ');

      let screenshotId = null;
      if (screenshotFile) {
        setIsUploading(true);
        try {
          const uploadRes = await uploadScreenshot(screenshotFile);
          screenshotId = uploadRes.id;
        } catch (err) {
          console.error("Screenshot upload failed:", err);
          // We continue anyway, or we could stop? 
          // User said "Order confirm verification ke bad hoga" so IDs are more important.
        } finally {
          setIsUploading(false);
        }
      }

      const payload = {
        customer_name: formData.fullName,
        customer_email: formData.email,
        customer_phone: formData.phone || null,
        shipping_address: shippingAddress,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        items: orderItems,
        total_amount: cartTotal,
        payment_id: paymentData.paymentId || null,
        screenshot_id: screenshotId,
        // ? Backend ``PaymentStatus``: pending | received | verified | failed
        payment_status: paymentData.paymentId?.trim() ? 'received' : 'pending',
        notes: null,
        status: 'pending',
        cart_id: cartId || null,
      };

      const createdOrder = await createOrder(payload);

      // Clear cart
      clearCart();

      // Redirect to success page with real order ID
      const orderId = createdOrder.id || createdOrder._id;
      router.push(`/order-success?id=${orderId}`);
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Empty cart guard
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center gap-6">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm">
            <ChevronLeft className="w-10 h-10 text-slate-300" />
          </div>
          <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
            Your cart is empty
          </h1>
          <p className="text-slate-500 max-w-sm">
            Please add some handcrafted items to your cart before checking out.
          </p>
          <Link
            href="/shop"
            className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
          >
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

          {/* Step indicator */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${step === 'shipping' ? 'text-blue-600' : 'text-green-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black ${step === 'shipping' ? 'bg-blue-600' : 'bg-green-500'}`}>
                {step === 'shipping' ? '1' : '✓'}
              </div>
              Shipping
            </div>
            <div className="w-8 h-px bg-slate-200" />
            <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${step === 'payment' ? 'text-blue-600' : 'text-slate-300'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black ${step === 'payment' ? 'bg-blue-600' : 'bg-slate-200'}`}>
                2
              </div>
              Payment
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mt-4">
            {/* Form Column */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              {/* ── Shipping Step ── */}
              {step === 'shipping' ? (
                <form onSubmit={handleProceedToPayment} className="flex flex-col gap-8">
                  <div className="bg-white rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-blue-950">
                        Shipping Details
                      </h2>
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
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                          Phone Number <span className="text-slate-300">(optional)</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+91 98765 43210"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Complete Address</label>
                        <textarea
                          required
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="Street, Landmark, Apartment No."
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">State</label>
                        <input
                          required
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          placeholder="Gujarat"
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
                /* ── Payment Step ── */
                <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                  <div className="bg-white rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-blue-950">Scan &amp; Pay</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                      {/* QR Code */}
                      <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                        <div className="w-full aspect-square bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex items-center justify-center">
                          <img
                            src="/images/qr-dummy.png"
                            alt="Payment QR Code"
                            className="w-full h-full object-contain p-4"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-full flex-col items-center justify-center gap-2 text-slate-300">
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            <span className="text-xs font-bold">QR Code</span>
                          </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-950/60 text-center">
                          Scan with GPay, PhonePe, or Paytm
                        </p>
                      </div>

                      {/* Input Column */}
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                            UPI / Transaction ID
                          </label>
                          <input
                            required
                            name="paymentId"
                            value={paymentData.paymentId}
                            onChange={handlePaymentChange}
                            placeholder="Ex: 123456789012"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                                        <div className="relative group cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              disabled={isUploading}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            {screenshotPreview ? (
                              <div className="w-full bg-slate-50 border-2 border-dashed border-blue-200 rounded-2xl p-4 flex items-center gap-4">
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                                  <img src={screenshotPreview} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-grow flex flex-col items-start gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Screenshot Ready</span>
                                  <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{screenshotFile?.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); clearScreenshot(); }}
                                  className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors z-20"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl px-5 py-8 text-center transition-all group-hover:border-blue-400 group-hover:bg-blue-50/30">
                                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-blue-500" />
                                <span className="text-xs font-bold text-slate-400 group-hover:text-blue-600 uppercase tracking-widest">
                                  Select Image
                                </span>
                              </div>
                            )}
                          </div>
           </div>
                      </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
                      <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest leading-loose">
                        Please pay exact amount: ₹{cartTotal.toLocaleString('en-IN')}. Your order will be confirmed after verification.
                      </p>
                    </div>
                  </div>

                  {submitError && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                      <p className="text-red-500 text-sm font-bold">{submitError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-6 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      'Confirm Payment & Place Order'
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Order Summary Column */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm sticky top-32">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-950 mb-8 pb-4 border-b border-slate-50">
                  Order Summary
                </h3>

                <div className="flex flex-col gap-6 max-h-[300px] overflow-y-auto pr-2 mb-8">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                        <p className="text-xs font-black uppercase text-blue-950 line-clamp-1">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {item.quantity} × ₹{(item.priceValue ?? item.price ?? 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4 pt-6 border-t border-slate-50">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Subtotal</span>
                    <span className="font-bold text-blue-950">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Shipping</span>
                    <span className="font-bold text-green-500 uppercase tracking-widest text-[10px]">Free</span>
                  </div>
                  <div className="flex justify-between text-base pt-4 border-t border-slate-50 mt-2">
                    <span className="text-blue-950 font-black uppercase tracking-tight">Total Amount</span>
                    <span className="font-black text-blue-600">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-4 bg-orange-50/50 p-6 rounded-2xl border border-orange-100">
                  <div className="flex gap-3 items-center">
                    <ShieldCheck className="w-5 h-5 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-900 leading-tight">
                      Secure Transaction Guaranteed
                    </span>
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
