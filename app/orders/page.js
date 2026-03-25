"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import { Package, Truck, CheckCircle, Clock, ChevronRight, ShoppingBag } from 'lucide-react';

const MyOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedOrders = JSON.parse(localStorage.getItem('soulcraft_orders') || '[]');
    setOrders(savedOrders);
    setLoading(false);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Processing': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'Shipped': return <Truck className="w-4 h-4 text-blue-500" />;
      case 'Delivered': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Processing': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Shipped': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Delivered': return 'bg-green-50 text-green-600 border-green-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-8 md:gap-12">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">
              My Orders.
            </h1>
            <p className="text-slate-500">Track your handcrafted treasures as they make their way to you.</p>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-[32px] p-12 text-center flex flex-col items-center gap-6 border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-black text-blue-950 uppercase">No orders yet</h3>
                <p className="text-slate-500 max-w-xs">It looks like you haven't placed any orders with us yet. Start exploring our shop!</p>
              </div>
              <Link href="/shop" className="bg-blue-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
                Browse Shop
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                  <div className="p-6 md:p-8 flex flex-col gap-6">
                    {/* Order Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order ID</span>
                        <span className="text-lg font-black text-blue-950">{order.id}</span>
                      </div>
                      <div className="flex flex-col gap-1 md:items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Date</span>
                        <span className="text-sm font-bold text-slate-600">{order.date}</span>
                      </div>
                      <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="text-[10px] font-black uppercase tracking-[0.1em]">{order.status}</span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-50 w-full" />

                    {/* Order Items Summary */}
                    <div className="flex flex-col gap-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-xs font-black uppercase text-blue-950">{item.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} x ₹{item.price}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="h-px bg-slate-50 w-full" />

                    {/* Order Total & Action */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Paid</span>
                        <span className="text-xl font-black text-blue-600">₹{order.total}</span>
                      </div>
                      <Link 
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors group-hover:translate-x-1 duration-300"
                      >
                        Order Details
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MyOrdersPage;
