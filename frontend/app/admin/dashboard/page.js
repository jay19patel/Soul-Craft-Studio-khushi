"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  getAdminStats, 
  getAdminOrders, 
  updateAdminOrder, 
  getAdminUsers, 
  getAdminCarts, 
  getAdminEmailLogs 
} from '../../../lib/api';
import { 
  Package, 
  ShoppingBag, 
  Banknote, 
  Clock, 
  ChevronLeft, 
  Loader2, 
  Search, 
  ExternalLink, 
  Image as ImageIcon, 
  Mail, 
  FileText, 
  User, 
  ShoppingCart, 
  Send, 
  AlertTriangle 
} from 'lucide-react';
import Link from 'next/link';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend
} from 'recharts';

export default function AdminDashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [carts, setCarts] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // orders, users, carts, emaillogs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(null);
  const [chartRange, setChartRange] = useState('7d'); // 7d, 1m, 1y, all
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    setError(null);
    try {
      const [statsData, ordersData, usersData, cartsData, logsData] = await Promise.all([
        getAdminStats(chartRange),
        getAdminOrders(),
        getAdminUsers(),
        getAdminCarts(),
        getAdminEmailLogs()
      ]);
      setStats(statsData);
      setOrders(ordersData);
      setUsers(usersData);
      setCarts(cartsData);
      setEmailLogs(logsData);
    } catch (err) {
      console.error(err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = async (newRange) => {
    setChartRange(newRange);
    try {
      const statsData = await getAdminStats(newRange);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to change analytics range:', err);
    }
  };

  const handleStatusUpdate = async (orderId, field, value) => {
    setUpdating(orderId);
    try {
      await updateAdminOrder(orderId, { [field]: value });
      setOrders(orders.map(o => o.id === orderId ? { ...o, [field]: value } : o));
      if (field === 'status' || field === 'payment_status') {
        getAdminStats(chartRange).then(setStats);
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

  // Filter lists based on Search term
  const filteredOrders = orders.filter(o => 
    String(o.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    (u.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCarts = carts.filter(c => 
    (c.user?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmailLogs = emailLogs.filter(log => 
    (log.to_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.email_type || '').toLowerCase().includes(searchTerm.toLowerCase())
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
            <button onClick={fetchData} className="px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-600 font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-indigo-50 transition-all shadow-sm">
              Refresh Data
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 md:gap-6">
              
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Banknote className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Revenue</span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">₹{(stats.total_revenue || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Orders</span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_orders || 0}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-orange-100 bg-orange-50/30 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center relative z-10">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex flex-col relative z-10">
                  <span className="text-xs font-bold text-orange-800 uppercase tracking-widest">Pending Orders</span>
                  <span className="text-2xl md:text-3xl font-black text-orange-600">{stats.pending_orders || 0}</span>
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
                  <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_products || 0}</span>
                </div>
              </Link>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Carts</span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.active_carts || 0}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inbox Messages</span>
                  <span className="text-2xl md:text-3xl font-black text-slate-900">{stats.total_messages || 0}</span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">New: {stats.unread_messages || 0}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Quick Links */}
          <div className="flex flex-wrap gap-4 mt-2">
            <Link href="/admin/products" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-widest rounded-full shadow-lg shadow-indigo-100 transition-all flex items-center gap-2">
              <Package className="w-4 h-4" /> Manage Products
            </Link>
            <Link href="/admin/messages" className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm uppercase tracking-widest rounded-full shadow-lg shadow-slate-100 transition-all flex items-center gap-2">
              <Mail className="w-4 h-4" /> View Inbox
            </Link>
          </div>

          {/* Chart Section */}
          {stats && stats.daily_stats && isMounted && (
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/20 p-6 md:p-10 flex flex-col gap-6">
              
              {/* Chart range filter + Title */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">
                  Sales & Orders Analytics
                </h2>
                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 text-xs font-black uppercase tracking-wider text-slate-400">
                  <button 
                    onClick={() => handleRangeChange('7d')}
                    className={`px-4 py-2 rounded-xl transition-all ${chartRange === '7d' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-600'}`}
                  >
                    7 Days
                  </button>
                  <button 
                    onClick={() => handleRangeChange('1m')}
                    className={`px-4 py-2 rounded-xl transition-all ${chartRange === '1m' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-600'}`}
                  >
                    1 Month
                  </button>
                  <button 
                    onClick={() => handleRangeChange('1y')}
                    className={`px-4 py-2 rounded-xl transition-all ${chartRange === '1y' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-600'}`}
                  >
                    1 Year
                  </button>
                  <button 
                    onClick={() => handleRangeChange('all')}
                    className={`px-4 py-2 rounded-xl transition-all ${chartRange === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-600'}`}
                  >
                    All Time
                  </button>
                </div>
              </div>

              <div className="w-full h-80">
                <ResponsiveContainer width="99%" height="100%">
                  <ComposedChart data={stats.daily_stats} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => String(v)} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}
                      labelStyle={{ fontWeight: 'black', color: '#1e293b', marginBottom: '4px' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Area yAxisId="left" type="monotone" dataKey="sales" name="Revenue (₹)" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    <Bar yAxisId="right" dataKey="orders" name="Orders Count" fill="#10b981" barSize={16} radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Extended Tabs Section */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/20 p-6 md:p-10 flex flex-col gap-8">
            
            {/* Header + Search + Tabs */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-100 pb-6">
              
              <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-wider">
                <button 
                  onClick={() => { setActiveTab('orders'); setSearchTerm(''); }} 
                  className={`px-5 py-3 rounded-full transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Orders ({orders.length})
                </button>
                <button 
                  onClick={() => { setActiveTab('users'); setSearchTerm(''); }} 
                  className={`px-5 py-3 rounded-full transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  <User className="w-3.5 h-3.5" /> Users ({users.length})
                </button>
                <button 
                  onClick={() => { setActiveTab('carts'); setSearchTerm(''); }} 
                  className={`px-5 py-3 rounded-full transition-all flex items-center gap-2 ${activeTab === 'carts' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> Carts ({carts.length})
                </button>
                <button 
                  onClick={() => { setActiveTab('emaillogs'); setSearchTerm(''); }} 
                  className={`px-5 py-3 rounded-full transition-all flex items-center gap-2 ${activeTab === 'emaillogs' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  <Send className="w-3.5 h-3.5" /> Email Logs ({emailLogs.length})
                </button>
              </div>

              <div className="relative w-full lg:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={
                    activeTab === 'orders' ? "Search by Order ID, name..." :
                    activeTab === 'users' ? "Search by email, name..." :
                    activeTab === 'carts' ? "Search by email, name..." :
                    "Search email logs..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

            </div>

            {/* TAB CONTENT: ORDERS */}
            {activeTab === 'orders' && (
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
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 font-mono">
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
                                <ImageIcon className="w-3.5 h-3.5" /> View Screenshot
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
            )}

            {/* TAB CONTENT: USERS */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b-2 border-slate-50">
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4">Joined Date</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">User Details</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Login ID / Username</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">No users found.</td>
                      </tr>
                    ) : filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-4 text-slate-500 font-mono text-xs">
                          {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{u.first_name || 'Guest User'}</span>
                            <span className="text-xs text-slate-400">{u.email}</span>
                          </div>
                        </td>
                        <td className="py-4 font-mono text-xs text-slate-700">{u.username}</td>
                        <td className="py-4">
                          {u.is_superuser ? (
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Super Admin</span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Customer</span>
                          )}
                        </td>
                        <td className="py-4">
                          {u.is_active ? (
                            <span className="text-green-600 font-bold text-xs">Active</span>
                          ) : (
                            <span className="text-red-500 font-bold text-xs">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: CARTS (Abandoned/Active Carts - Read Only) */}
            {activeTab === 'carts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCarts.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-slate-500">No active carts found.</div>
                ) : filteredCarts.map((c) => (
                  <div key={c.id} className="bg-slate-50/50 border border-slate-100 p-6 rounded-3xl flex flex-col gap-4">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm">{c.user?.full_name}</span>
                        <span className="text-xs text-slate-400">{c.user?.email}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Updated: {new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {c.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 uppercase tracking-wide">{item.product_name}</span>
                            {item.variant_info && (
                              <span className="text-[10px] text-slate-400">Variant: {item.variant_info}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-slate-600">
                            <span>Qty: {item.quantity}</span>
                            <span className="font-bold">₹{item.price * item.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs font-black uppercase text-indigo-600">
                      <span>Total Value</span>
                      <span>₹{c.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: EMAIL LOGS */}
            {activeTab === 'emaillogs' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b-2 border-slate-50">
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4">Timestamp</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type / Subject</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">SMTP backend</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                      <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Logs / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {filteredEmailLogs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">No email logs found.</td>
                      </tr>
                    ) : filteredEmailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-4 text-slate-500 font-mono leading-relaxed">
                          {new Date(log.queued_at).toLocaleDateString()}<br />
                          {new Date(log.queued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-4">
                          <span className="font-bold text-slate-700">{log.to_email}</span>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex flex-col gap-1">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black text-[9px] uppercase w-fit tracking-wider">{log.email_type}</span>
                            <span className="font-medium text-slate-800 leading-normal">{log.subject}</span>
                          </div>
                        </td>
                        <td className="py-4 font-mono uppercase text-[10px] text-slate-500">
                          {log.backend}
                        </td>
                        <td className="py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            log.status === 'SENT' ? 'bg-emerald-50 text-emerald-600' :
                            log.status === 'FAILED' ? 'bg-red-50 text-red-600 border border-red-100 animate-pulse' :
                            'bg-orange-50 text-orange-600'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 pr-4 align-middle">
                          {log.error_message ? (
                            <span className="text-red-500 font-mono block max-w-[200px] truncate" title={log.error_message}>
                              ⚠️ {log.error_message}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">Success</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>
      </main>
      
      <Footer />
    </div>
  );
}
