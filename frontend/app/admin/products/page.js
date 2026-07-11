"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { getAdminProducts, createAdminProduct, updateAdminProduct, deleteAdminProduct, getCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory } from '../../../lib/api';
import { Package, Plus, Search, Edit3, Trash2, X, ChevronLeft, Settings } from 'lucide-react';
import Link from 'next/link';

export default function AdminProductsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
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
    category: '',
    is_active: true,
    stock: 20,
    discount: ''
  });

  // Category Management State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image: null
  });

  // Submission guards to prevent double-click / double-submit creating duplicate entries
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.is_superuser) {
      fetchProducts();
      fetchCategories();
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
        category: product.category?.id || product.category_id || '',
        is_active: product.is_active !== undefined ? !!product.is_active : true,
        stock: product.stock ?? 0,
        discount: product.discount || '',
        image: null,
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', slug: '', description: '', price: '', category: '', is_active: true, stock: 20, discount: '', image: null });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSavingProduct) return;
    setIsSavingProduct(true);
    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('slug', formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
      submitData.append('description', formData.description);
      submitData.append('price', formData.price);
      submitData.append('base_price', formData.price);
      submitData.append('discount', formData.discount || '0');
      submitData.append('is_active', formData.is_active ? 'true' : 'false');
      if (formData.category) {
        submitData.append('category_id', formData.category);
      }
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      const existingVariants = editingProduct?.variants || [];
      const variantsPayload = existingVariants.length > 0
        ? [{ ...existingVariants[0], stock: Number(formData.stock) || 0 }]
        : [{ stock: Number(formData.stock) || 0 }];
      submitData.append('variants', JSON.stringify(variantsPayload));

      if (editingProduct) {
        await updateAdminProduct(editingProduct.id, submitData);
      } else {
        await createAdminProduct(submitData);
      }
      closeModal();
      fetchProducts();
    } catch (err) {
      alert('Error saving product: ' + err.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDelete = async (id) => {
    if (deletingProductId) return;
    if (window.confirm("Are you sure you want to delete this product?")) {
      setDeletingProductId(id);
      try {
        await deleteAdminProduct(id);
        fetchProducts();
      } catch (err) {
        alert('Error deleting product: ' + err.message);
      } finally {
        setDeletingProductId(null);
      }
    }
  };

  // Category CRUD Handlers
  const handleCategorySave = async (e) => {
    e.preventDefault();
    if (isSavingCategory) return;
    setIsSavingCategory(true);
    try {
      const submitData = new FormData();
      submitData.append('name', categoryFormData.name);
      submitData.append('slug', categoryFormData.slug || categoryFormData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
      submitData.append('description', categoryFormData.description);
      if (categoryFormData.image) {
        submitData.append('image', categoryFormData.image);
      }

      if (editingCategory) {
        await updateAdminCategory(editingCategory.id, submitData);
      } else {
        await createAdminCategory(submitData);
      }

      // Reset form and reload
      setCategoryFormData({ name: '', slug: '', description: '', image: null });
      setEditingCategory(null);
      fetchCategories();
      fetchProducts(); // Refresh product list in case category names updated
    } catch (err) {
      alert('Error saving category: ' + err.message);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleCategoryDelete = async (id) => {
    if (deletingCategoryId) return;
    if (window.confirm("Are you sure you want to delete this category? All products under it will revert to the default category.")) {
      setDeletingCategoryId(id);
      try {
        await deleteAdminCategory(id);
        fetchCategories();
        fetchProducts();
      } catch (err) {
        alert('Error deleting category: ' + err.message);
      } finally {
        setDeletingCategoryId(null);
      }
    }
  };

  const startCategoryEdit = (cat) => {
    setEditingCategory(cat);
    setCategoryFormData({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      image: null
    });
  };

  const cancelCategoryEdit = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: '', slug: '', description: '', image: null });
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
            
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 border border-slate-200"
              >
                <Settings className="w-4 h-4 text-slate-500" /> Manage Categories
              </button>
              <button 
                onClick={() => openModal()}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" /> Add Product
              </button>
            </div>
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
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4">Product Details</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Price</th>
                    <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-500 text-sm font-medium">No products found.</td>
                    </tr>
                  ) : filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4 pl-4 align-middle">
                        <div className="flex items-center gap-4">
                          {/* Product Image */}
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          {/* Product Info */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-slate-900">{product.name}</span>
                              {product.category?.name && (
                                <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                  {product.category.name}
                                </span>
                              )}
                              {!product.is_active && (
                                <span className="bg-red-50 text-red-500 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 align-middle">
                        <span className="font-black text-indigo-600">₹{Number(product.priceValue || product.price || 0).toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-4 pr-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openModal(product)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            disabled={deletingProductId === product.id}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

              <div className="grid grid-cols-3 gap-4">
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount}
                    onChange={(e) => setFormData({...formData, discount: e.target.value})}
                    placeholder="0"
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
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

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({...formData, image: e.target.files[0]})}
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <label className="flex items-center gap-3 bg-slate-50 rounded-xl py-3 px-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span className="text-sm font-bold text-slate-700">Active (visible in shop)</span>
              </label>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={closeModal} disabled={isSavingProduct} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingProduct} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSavingProduct ? 'Saving...' : 'Save Product'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col transform transition-all h-[80vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black uppercase tracking-tight text-indigo-950">
                Manage Categories
              </h3>
              <button 
                onClick={() => { setIsCategoryModalOpen(false); cancelCategoryEdit(); }} 
                className="text-slate-400 hover:text-slate-700 bg-white p-2 rounded-full shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Categories List */}
              <div className="w-full md:w-1/2 p-8 border-r border-slate-100 overflow-y-auto flex flex-col gap-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Existing Categories ({categories.length})</h4>
                <div className="flex flex-col gap-3">
                  {categories.length === 0 ? (
                    <p className="text-sm font-medium text-slate-500 text-center py-6">No categories found.</p>
                  ) : (
                    categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-200">
                            {cat.img || cat.image || cat.image_url ? (
                              <img src={cat.img || cat.image || cat.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-900 leading-tight">{cat.name}</span>
                            <span className="text-[10px] font-medium text-slate-400 font-mono mt-0.5">{cat.slug}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startCategoryEdit(cat)}
                            disabled={deletingCategoryId === cat.id}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCategoryDelete(cat.id)}
                            disabled={deletingCategoryId === cat.id}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Right Column: Category Form */}
              <div className="w-full md:w-1/2 p-8 overflow-y-auto bg-slate-50/30 flex flex-col gap-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h4>
                
                <form onSubmit={handleCategorySave} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Category Name</label>
                    <input 
                      type="text" 
                      required
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({...categoryFormData, name: e.target.value})}
                      placeholder="e.g. Handmade Woolens"
                      className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Slug (URL Name)</label>
                    <input 
                      type="text" 
                      value={categoryFormData.slug}
                      onChange={(e) => setCategoryFormData({...categoryFormData, slug: e.target.value})}
                      placeholder="e.g. handmade-woolens (Optional)"
                      className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Description</label>
                    <textarea 
                      rows={3}
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData({...categoryFormData, description: e.target.value})}
                      placeholder="Category details..."
                      className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Category Image</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setCategoryFormData({...categoryFormData, image: e.target.files[0]})}
                      className="w-full bg-white border border-slate-100 rounded-xl py-2 px-4 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={cancelCategoryEdit}
                        disabled={isSavingCategory}
                        className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingCategory}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingCategory ? 'Saving...' : editingCategory ? 'Update Category' : 'Save Category'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
