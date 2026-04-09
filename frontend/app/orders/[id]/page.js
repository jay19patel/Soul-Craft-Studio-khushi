"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import Link from 'next/link';
import { 
  ChevronLeft, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  MapPin, 
  CreditCard,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';

const OrderDetailsPage = () => {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedOrders = JSON.parse(localStorage.getItem('soulcraft_orders') || '[]');
    const foundOrder = savedOrders.find(o => o.id === params.id);
    
    if (foundOrder) {
      setOrder(foundOrder);
    }
    setLoading(false);
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center gap-6">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-blue-950 uppercase">Order Not Found</h1>
          <Link href="/orders" className="text-blue-600 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back to Orders
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const getStatusStep = (status) => {
    const steps = ['Processing', 'Shipped', 'Delivered'];
    return steps.indexOf(status);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-grow w-full max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-8 md:gap-12">
          {/* Header & Back Link */}
          <div className="flex flex-col gap-6">
            <Link 
              href="/orders" 
              className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors w-fit"
            >
              <div className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-blue-100 group-hover:bg-blue-50 transition-all">
                <ChevronLeft className="w-3 h-3" />
              </div>
              Back to Orders
            </Link>
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
                  Order Details.
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  Order ID: <span className="text-blue-600">#{order.id}</span> • {order.date}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="px-4 py-2 bg-blue-600 text-white rounded-full font-black uppercase tracking-widest text-[10px]">
                  Order Status: {order.status}
                </div>
                {order.paymentStatus && (
                  <div className="px-3 py-1 bg-orange-50 text-orange-500 border border-orange-100 rounded-full font-black uppercase tracking-widest text-[9px]">
                    Payment: {order.paymentStatus}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Tracker */}
          <div className="bg-white rounded-[32px] p-8 md:p-12 border border-slate-100 shadow-sm">
            <div className="relative flex justify-between items-center max-w-2xl mx-auto">
              {/* Progress Line */}
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
              <div 
                className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-1000" 
                style={{ width: `${(getStatusStep(order.status) / 2) * 100}%` }}
              />

              {[
                { label: 'Processing', icon: Clock },
                { label: 'Shipped', icon: Truck },
                { label: 'Delivered', icon: CheckCircle }
              ].map((step, idx) => {
                const stepIdx = getStatusStep(order.status);
                const isCompleted = stepIdx >= idx;
                const isActive = stepIdx === idx;
                const Icon = step.icon;
                return (
                  <div key={idx} className="relative z-10 flex flex-col items-center gap-3 bg-white px-2">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                      isCompleted 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                      : 'bg-white border-slate-100 text-slate-300'
                    } ${isActive ? 'scale-110' : ''}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest text-center ${
                      isCompleted ? 'text-blue-950' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Items */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
                <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-widest text-blue-950">Ordered Items</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.items.length} Items</span>
                </div>
                <div className="p-6 md:p-8 flex flex-col gap-6">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex gap-4 md:gap-6 items-center">
                      <div className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 shadow-sm">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-grow flex flex-col gap-1">
                        <h4 className="text-sm font-black uppercase text-blue-950 leading-tight">{item.name}</h4>
                        <p className="text-xs font-bold text-slate-400">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-blue-600">₹{item.price * item.quantity}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">₹{item.price} each</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="h-px bg-slate-50 w-full mt-2" />
                  
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                      <span>Subtotal</span>
                      <span>₹{order.total}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-green-600 uppercase tracking-widest">
                      <span>Shipping</span>
                      <span>FREE</span>
                    </div>
                    <div className="flex justify-between text-xl font-black text-blue-950 uppercase pt-4 mt-2 border-t border-slate-50">
                      <span>Total Amount</span>
                      <span>₹{order.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Info Cards */}
            <div className="flex flex-col gap-6">
              {/* Shipping Address */}
              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 h-fit">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-950">Shipping To</h3>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-black text-blue-950 uppercase">{order.shipping.fullName}</p>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase">
                    {order.shipping.address}<br />
                    {order.shipping.city}, {order.shipping.pincode}
                  </p>
                  <div className="flex flex-col gap-1 pt-2">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Contact</p>
                    <p className="text-xs font-bold text-blue-600 lowercase">{order.shipping.email}</p>
                  </div>
                </div>
              </div>

              {/* Payment Method - Updated for Online Payment */}
              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 h-fit relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-950">Payment Detail</h3>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Method</p>
                    <p className="text-xs font-black text-blue-950 uppercase tracking-widest">Online (QR Code)</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Transaction ID</p>
                    <p className="text-xs font-bold text-blue-600 truncate">{order.paymentId || 'Pending'}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Verification Status</p>
                    <p className="text-[10px] font-black text-orange-500 uppercase">{order.paymentStatus || 'Pending'}</p>
                  </div>
                </div>
              </div>

              {/* Help Link */}
              <Link href="/contact" className="bg-blue-950 text-white rounded-[32px] p-8 flex flex-col gap-4 group hover:bg-blue-900 transition-colors">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-200">Need help?</h3>
                <p className="text-sm font-black uppercase flex items-center justify-between">
                  Contact Support
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </p>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderDetailsPage;
