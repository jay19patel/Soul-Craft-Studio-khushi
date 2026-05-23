"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { getAdminProducts, createAdminProduct, updateAdminProduct, deleteAdminProduct } from '../../../lib/api';
import { Package, Plus, Search, Edit3, Trash2, X, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminProductsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    category: ''
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.is_superuser) {
      fetchProducts();
    } else if (isAuthenticated && !user?.is_superuser) {
      router.push('/profile');
    }
  }, [isAuthenticated, user, router]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAdminProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        price: product.priceValue || product.price || '',
        category: product.category || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', slug: '', description: '', price: '', category: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        description: formData.description,
        price: formData.price
      };

      if (editingProduct) {
        await updateAdminProduct(editingProduct.id, payload);
      } else {
        // category is required in the backend for creation, let's pass a default or the first one.
        // For simplicity, we just send the payload and if it fails, the backend will reject it.
        await createAdminProduct(payload);
      }
      closeModal();
      fetchProducts();
    } catch (err) {
      alert('Error saving product: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteAdminProduct(id);
        fetchProducts();
      } catch (err) {
        alert('Error deleting product: ' + err.message);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-100">
      <Navbar />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        
        <div className="flex flex-col gap-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex flex-col gap-4">
              <Link href="/admin/dashboard" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors w-fit">
                <ChevronLeft className="w-4 h-4" /> Dashboard
              </Link>
              <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-climate-crisis)] uppercase text-indigo-950">
                Products.
              </h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                Manage your store inventory
              </p>
            </div>
            
            <button 
              onClick={() => openModal()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> Add Product
            </button>
          </div>

          {/* List Section */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 p-6 md:p-10 flex flex-col gap-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
                All Products <span className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full">{products.length}</span>
              </h2>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-slate-50">
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4 w-16">Image</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Product Name</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Price</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-500 text-sm font-medium">No products found.</td>
                    </tr>
                  ) : filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4 pl-4 align-middle">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-sm text-slate-900">{product.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.slug}</span>
                        </div>
                      </td>
                      <td className="py-4 align-middle">
                        <span className="font-black text-indigo-600">₹{Number(product.priceValue || product.price || 0).toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-4 pr-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openModal(product)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transform transition-all">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black uppercase tracking-tight text-indigo-950">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 bg-white p-2 rounded-full shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Price (₹)</label>
                <input 
                  type="number" 
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label>
                <textarea 
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">
                  Save Product
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
