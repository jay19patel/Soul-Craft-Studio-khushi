"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { getAdminStats, getAdminOrders, updateAdminOrder } from '../../../lib/api';
import { Package, ShoppingBag, Banknote, Clock, ChevronLeft, Loader2, Search, ExternalLink, Image as ImageIcon, Mail, FileText } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && isAuthenticated && !user?.is_superuser) {
      router.push('/profile');
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.is_superuser) {
      fetchData();
    }
  }, [isAuthenticated, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, ordersData] = await Promise.all([
        getAdminStats(),
        getAdminOrders(),
      ]);
      setStats(statsData);
      setOrders(ordersData);
    } catch (err) {
      console.error(err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, field, value) => {
    setUpdating(orderId);
    try {
      await updateAdminOrder(orderId, { [field]: value });
      setOrders(orders.map(o => o.id === orderId ? { ...o, [field]: value } : o));
      if (field === 'status' || field === 'payment_status') {
        getAdminStats().then(setStats);
      }
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update order');
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </main>
      </div>
    );
  }

  if (!user?.is_superuser) return null;

  const filteredOrders = orders.filter(o => 
    String(o.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-12 md:py-20">
        <div className="flex flex-col gap-10">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="flex flex-col gap-2">
              <Link href="/profile" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 w-fit transition-colors">
                <ChevronLeft className="w-4 h-4" />
                Back to Profile
              </Link>
              <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-slate-900">
                Admin <span className="text-indigo-600">Dashboard.</span>
              </h1>
            </div>
            <button onClick={fetchData} className="px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-600 font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-indigo-50 transition-all">
              Refresh Data
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100">
              {error}
            </div>
          )}

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Banknote className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Revenue</span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">₹{stats.total_revenue.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Orders</span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_orders}</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-orange-100 bg-orange-50/30 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center relative z-10">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex flex-col relative z-10">
                  <span className="text-xs font-bold text-orange-800 uppercase tracking-widest">Pending Orders</span>
                  <span className="text-2xl md:text-3xl font-black text-orange-600">{stats.pending_orders}</span>
                </div>
                {stats.pending_orders > 0 && (
                   <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500 rounded-full blur-3xl opacity-20"></div>
                )}
              </div>
              <Link href="/admin/products" className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4 hover:shadow-md hover:border-indigo-100 transition-all group">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">Total Products <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" /></span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_products}</span>
                </div>
              </Link>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inbox Messages</span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_messages || 0}</span>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">Unread: {stats.unread_messages || 0}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">Read: {stats.read_messages || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="flex flex-wrap gap-4 mt-2">
            <Link href="/admin/products" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-widest rounded-full shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
              <Package className="w-4 h-4" /> Manage Products
            </Link>
            <Link href="/admin/messages" className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm uppercase tracking-widest rounded-full shadow-lg shadow-slate-200 transition-all flex items-center gap-2">
              <Mail className="w-4 h-4" /> View Inbox
            </Link>
          </div>



          {/* Orders Section */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 p-6 md:p-10 flex flex-col gap-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
                Recent Orders <span className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full">{orders.length}</span>
              </h2>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search orders..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b-2 border-slate-50">
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4">Order Details</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Info</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Status</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Order Status</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500 text-sm">No orders found.</td>
                    </tr>
                  ) : filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-6 pl-4 pr-4 align-top">
                        <div className="flex flex-col gap-1">
                          <Link href={`/orders/${order.id}`} className="font-black text-sm text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 group-hover:underline w-fit">
                            #{order.id} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <span className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {order.items?.length || 0} {(order.items?.length === 1) ? 'item' : 'items'}
                          </span>
                          <span className="text-sm font-bold text-indigo-600 mt-1">₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
                        </div>
                      </td>
                      <td className="py-6 pr-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-sm text-slate-800">{order.customer_name || 'N/A'}</span>
                          <span className="text-xs text-slate-500">{order.customer_email || 'N/A'}</span>
                          <span className="text-xs text-slate-500">{order.customer_phone || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-6 pr-4 align-top">
                        <div className="flex flex-col gap-2">
                          {order.payment_reference && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Ref:</span>
                              <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{order.payment_reference}</span>
                            </div>
                          )}
                          <span className="text-xs text-slate-500 font-mono">{order.upi_transaction_id || 'No UPI Transaction ID'}</span>
                          {order.screenshot_url ? (
                            <a href={order.screenshot_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg w-fit transition-colors">
                              <ImageIcon className="w-3 h-3" /> View Screenshot
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">No Screenshot</span>
                          )}
                        </div>
                      </td>
                      <td className="py-6 pr-4 align-top">
                        <select
                          value={order.payment_status}
                          onChange={(e) => handleStatusUpdate(order.id, 'payment_status', e.target.value)}
                          disabled={updating === order.id}
                          className={`text-xs font-bold uppercase tracking-wider rounded-xl px-3 py-2 border-2 outline-none appearance-none cursor-pointer transition-colors ${
                            order.payment_status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            order.payment_status === 'PENDING' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                            order.payment_status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-blue-50 text-blue-700 border-blue-100'
                          }`}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="RECEIVED">Received</option>
                          <option value="VERIFIED">Verified</option>
                          <option value="FAILED">Failed</option>
                        </select>
                      </td>
                      <td className="py-6 pr-4 align-top">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusUpdate(order.id, 'status', e.target.value)}
                          disabled={updating === order.id}
                          className={`text-xs font-bold uppercase tracking-wider rounded-xl px-3 py-2 border-2 outline-none appearance-none cursor-pointer transition-colors ${
                            order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            order.status === 'PENDING' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                            order.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="PROCESSING">Processing</option>
                          <option value="SHIPPED">Shipped</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-6 pr-4 align-top">
                        <Link href={`/orders/${order.id}/invoice`} target="_blank" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors">
                          <FileText className="w-3.5 h-3.5" /> Invoice
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
      
      <Footer />
    </div>
  );
}
